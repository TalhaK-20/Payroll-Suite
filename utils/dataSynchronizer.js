const Payroll = require('../models/Payroll');
const MonthlyHours = require('../models/MonthlyHours');
const Alert = require('../models/Alert');

/**
 * Data Synchronization Engine
 * Manages bidirectional sync between Payroll and Monthly Hours
 */
class DataSynchronizer {
  /**
   * Sync payroll data with monthly hours
   * When payroll is created/updated, update corresponding monthly hours
   */
  async syncPayrollToMonthlyHours(payrollData) {
    try {
      const { guardId, totalHours, totalMinutes, payRate, pay1, pay2, pay3 } = payrollData;
      
      // Get current date
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      // Find or create monthly hours record
      let monthlyHours = await MonthlyHours.findOne({
        guardId,
        year,
        month
      });

      if (!monthlyHours) {
        monthlyHours = new MonthlyHours({
          guardId,
          year,
          month,
          totalHours: totalHours || 0,
          totalMinutes: totalMinutes || 0
        });
      } else {
        // Update existing record
        monthlyHours.totalHours = totalHours || monthlyHours.totalHours;
        monthlyHours.totalMinutes = totalMinutes || monthlyHours.totalMinutes;
      }

      // Calculate paid hours from payroll
      const payAmount = (pay1 || 0) + (pay2 || 0) + (pay3 || 0);
      const hourlyRate = payRate || 0;
      
      if (hourlyRate > 0) {
        const paidHoursDecimal = payAmount / hourlyRate;
        monthlyHours.paidHours = Math.floor(paidHoursDecimal);
        monthlyHours.paidMinutes = Math.round((paidHoursDecimal % 1) * 60);
      }

      await monthlyHours.save();

      return {
        success: true,
        message: 'Monthly hours synced with payroll data',
        data: monthlyHours
      };
    } catch (error) {
      console.error('Error syncing payroll to monthly hours:', error);
      throw error;
    }
  }

  /**
   * Sync monthly hours data with payroll
   * When monthly hours are updated, update corresponding payroll records
   */
  async syncMonthlyHoursToPayroll(monthlyHoursData) {
    try {
      const { guardId, totalHours, totalMinutes, year, month } = monthlyHoursData;

      // Find payroll records for this month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const payrollRecords = await Payroll.find({
        guardId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      // Update all payroll records with new hours
      const updates = payrollRecords.map(async (payroll) => {
        payroll.totalHours = totalHours;
        payroll.totalMinutes = totalMinutes || 0;
        payroll.updatedAt = new Date();
        return payroll.save();
      });

      await Promise.all(updates);

      return {
        success: true,
        message: `Synced ${payrollRecords.length} payroll records with monthly hours`,
        recordsUpdated: payrollRecords.length
      };
    } catch (error) {
      console.error('Error syncing monthly hours to payroll:', error);
      throw error;
    }
  }

  /**
   * Validate data consistency between payroll and monthly hours
   */
  async validateDataConsistency(guardId, year, month) {
    try {
      // Get monthly hours
      const monthlyHours = await MonthlyHours.findOne({
        guardId,
        year,
        month
      }).lean();

      // Get payroll records
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const payrollRecords = await Payroll.find({
        guardId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean();

      const validation = {
        isConsistent: true,
        issues: []
      };

      // Check if hours match
      const payrollTotalHours = payrollRecords.reduce((sum, p) => sum + (p.totalHours || 0), 0);
      
      if (monthlyHours && payrollTotalHours !== monthlyHours.totalHours) {
        validation.isConsistent = false;
        validation.issues.push({
          type: 'HOURS_MISMATCH',
          monthlyHours: monthlyHours.totalHours,
          payrollTotal: payrollTotalHours,
          difference: payrollTotalHours - monthlyHours.totalHours
        });
      }

      // Check if any hours are unpaid
      if (monthlyHours && monthlyHours.remainingHours < 0) {
        validation.isConsistent = false;
        validation.issues.push({
          type: 'OVERPAID',
          overpaidHours: Math.abs(monthlyHours.remainingHours)
        });
      }

      // Check if payroll exists when hours are recorded
      if (monthlyHours && monthlyHours.totalHours > 0 && payrollRecords.length === 0) {
        validation.isConsistent = false;
        validation.issues.push({
          type: 'MISSING_PAYROLL',
          hoursWorked: monthlyHours.totalHours
        });
      }

      return validation;
    } catch (error) {
      console.error('Error validating data consistency:', error);
      throw error;
    }
  }

  /**
   * Create alert for data inconsistencies
   */
  async createConsistencyAlert(guardId, year, month, issues) {
    try {
      // Map issue types to valid alert types
      const alertTypeMap = {
        'HOURS_MISMATCH': 'missing_hours',
        'OVERPAID': 'overpayment_risk',
        'MISSING_PAYROLL': 'missing_hours',
        'INCONSISTENT_RATES': 'missing_hours'
      };

      // Map issue types to severity levels
      const severityMap = {
        'HOURS_MISMATCH': 'warning',
        'OVERPAID': 'critical',
        'MISSING_PAYROLL': 'warning',
        'INCONSISTENT_RATES': 'info'
      };

      const alertPromises = issues.map(issue => {
        const { title, description } = this.getAlertMessages(issue);
        const alertType = alertTypeMap[issue.type] || 'missing_hours';
        const severity = severityMap[issue.type] || 'warning';

        const alert = new Alert({
          alertType,
          severity,
          guardId,
          title,
          description,
          relatedData: {
            year,
            month,
            issue: issue.type,
            unpaidHours: issue.monthlyHours || issue.hoursWorked || 0,
            unpaidMinutes: 0,
            ...issue
          }
        });
        return alert.save();
      });

      await Promise.all(alertPromises);

      return {
        success: true,
        alertsCreated: issues.length
      };
    } catch (error) {
      console.error('Error creating consistency alert:', error);
      throw error;
    }
  }

  /**
   * Get alert title and description based on issue type
   */
  getAlertMessages(issue) {
    const messages = {
      'HOURS_MISMATCH': {
        title: 'Hours Mismatch Detected',
        description: `Hours mismatch detected. Monthly hours: ${issue.monthlyHours}h, Payroll total: ${issue.payrollTotal}h. Difference: ${issue.difference}h`
      },
      'OVERPAID': {
        title: 'Potential Overpayment',
        description: `Warning: Guard has been paid for ${issue.overpaidHours} more hours than worked`
      },
      'MISSING_PAYROLL': {
        title: 'Missing Payroll Entry',
        description: `${issue.hoursWorked} hours recorded in monthly hours but no payroll entry found`
      },
      'INCONSISTENT_RATES': {
        title: 'Inconsistent Pay Rates',
        description: 'Pay rates don\'t match between payroll records'
      }
    };

    return messages[issue.type] || {
      title: 'Data Inconsistency Detected',
      description: 'A data consistency issue was detected between monthly hours and payroll'
    };
  }

  /**
   * Get sync status for a guard and month
   */
  async getSyncStatus(guardId, year, month) {
    try {
      const monthlyHours = await MonthlyHours.findOne({
        guardId,
        year,
        month
      }).lean();

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const payrollRecords = await Payroll.find({
        guardId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean();

      // Check recent alerts for this month
      const recentAlerts = await Alert.findOne({
        guardId,
        'relatedData.year': year,
        'relatedData.month': month
      }).sort({ createdAt: -1 }).lean();

      return {
        monthlyHoursExists: !!monthlyHours,
        payrollRecordsCount: payrollRecords.length,
        lastSyncTime: recentAlerts?.createdAt || null,
        syncStatus: monthlyHours && payrollRecords.length > 0 ? 'SYNCED' : 'PENDING',
        needsAttention: !!(monthlyHours && payrollRecords.length === 0)
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }

  /**
   * Bulk sync all guards for a specific month
   */
  async bulkSyncMonth(year, month) {
    try {
      // Get all monthly hours for the month
      const monthlyHours = await MonthlyHours.find({ year, month }).lean();

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const record of monthlyHours) {
        try {
          results.processed++;
          
          // Validate consistency
          const validation = await this.validateDataConsistency(
            record.guardId,
            year,
            month
          );

          if (!validation.isConsistent) {
            // Create alerts
            await this.createConsistencyAlert(
              record.guardId,
              year,
              month,
              validation.issues
            );
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            guardId: record.guardId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulk sync:', error);
      throw error;
    }
  }
}

module.exports = new DataSynchronizer();
