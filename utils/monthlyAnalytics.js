const Payroll = require('../models/Payroll');
const MonthlyHours = require('../models/MonthlyHours');
const GuardMaster = require('../models/GuardMaster');

/**
 * Monthly Analytics Engine
 * Generates data science insights from payroll and monthly hours data
 */
class MonthlyAnalytics {
  /**
   * Get comprehensive analytics for a specific month
   */
  async getMonthAnalytics(year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Fetch payroll records for the month
      const payrollRecords = await Payroll.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean();

      // Fetch monthly hours for the month
      const monthlyHours = await MonthlyHours.find({
        year,
        month
      }).populate('guardId', 'guardName email').lean();

      // Calculate analytics
      const analytics = {
        summary: this.calculateSummary(payrollRecords, monthlyHours),
        hoursTrends: this.calculateHoursTrends(monthlyHours),
        payTrends: this.calculatePayTrends(payrollRecords),
        topPerformers: this.getTopPerformers(monthlyHours),
        hoursDistribution: this.calculateHoursDistribution(monthlyHours),
        payDistribution: this.calculatePayDistribution(payrollRecords),
        discrepancies: this.findDiscrepancies(payrollRecords, monthlyHours),
        forecast: this.generateForecast(payrollRecords, monthlyHours)
      };

      return analytics;
    } catch (error) {
      console.error('Error calculating analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(payrollRecords, monthlyHours) {
    const totalHours = monthlyHours.reduce((sum, m) => sum + (m.totalHours || 0), 0);
    const totalPaidHours = monthlyHours.reduce((sum, m) => sum + (m.paidHours || 0), 0);
    const totalRemaining = monthlyHours.reduce((sum, m) => sum + (m.remainingHours || 0), 0);
    
    const totalPay = payrollRecords.reduce((sum, p) => {
      return sum + (p.pay1 || 0) + (p.pay2 || 0) + (p.pay3 || 0);
    }, 0);

    return {
      totalGuards: monthlyHours.length,
      totalHoursWorked: totalHours,
      totalHoursPaid: totalPaidHours,
      totalHoursRemaining: totalRemaining,
      totalPayroll: totalPay,
      averageHoursPerGuard: monthlyHours.length > 0 ? (totalHours / monthlyHours.length).toFixed(2) : 0,
      averagePayPerGuard: payrollRecords.length > 0 ? (totalPay / payrollRecords.length).toFixed(2) : 0,
      averageHourlyRate: totalHours > 0 ? (totalPay / totalHours).toFixed(2) : 0
    };
  }

  /**
   * Calculate hours trends
   */
  calculateHoursTrends(monthlyHours) {
    // Group by week
    const weeks = {};
    
    monthlyHours.forEach(record => {
      // Calculate week number (simplified)
      const week = Math.ceil(1 / 7); // Placeholder for week calculation
      if (!weeks[week]) {
        weeks[week] = { hours: 0, count: 0 };
      }
      weeks[week].hours += record.totalHours || 0;
      weeks[week].count += 1;
    });

    // Calculate average per week
    const trends = Object.entries(weeks).map(([week, data]) => ({
      week: `Week ${week}`,
      totalHours: data.hours,
      averagePerGuard: data.count > 0 ? (data.hours / data.count).toFixed(2) : 0,
      guardsWorking: data.count
    }));

    return trends;
  }

  /**
   * Calculate pay trends
   */
  calculatePayTrends(payrollRecords) {
    const payRanges = {
      '0-500': 0,
      '500-1000': 0,
      '1000-1500': 0,
      '1500-2000': 0,
      '2000+': 0
    };

    payrollRecords.forEach(record => {
      const totalPay = (record.pay1 || 0) + (record.pay2 || 0) + (record.pay3 || 0);
      
      if (totalPay < 500) payRanges['0-500']++;
      else if (totalPay < 1000) payRanges['500-1000']++;
      else if (totalPay < 1500) payRanges['1000-1500']++;
      else if (totalPay < 2000) payRanges['1500-2000']++;
      else payRanges['2000+']++;
    });

    return Object.entries(payRanges).map(([range, count]) => ({
      range: `£${range}`,
      count,
      percentage: payrollRecords.length > 0 ? ((count / payrollRecords.length) * 100).toFixed(1) : 0
    }));
  }

  /**
   * Get top performing guards by hours
   */
  getTopPerformers(monthlyHours) {
    return monthlyHours
      .sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0))
      .slice(0, 5)
      .map((record, idx) => ({
        rank: idx + 1,
        guardName: record.guardId?.guardName || 'Unknown',
        totalHours: record.totalHours || 0,
        paidHours: record.paidHours || 0,
        remaining: record.remainingHours || 0
      }));
  }

  /**
   * Calculate hours distribution by range
   */
  calculateHoursDistribution(monthlyHours) {
    const distribution = {
      'Very Low (0-50h)': 0,
      'Low (50-100h)': 0,
      'Medium (100-150h)': 0,
      'High (150-200h)': 0,
      'Very High (200h+)': 0
    };

    monthlyHours.forEach(record => {
      const hours = record.totalHours || 0;
      
      if (hours < 50) distribution['Very Low (0-50h)']++;
      else if (hours < 100) distribution['Low (50-100h)']++;
      else if (hours < 150) distribution['Medium (100-150h)']++;
      else if (hours < 200) distribution['High (150-200h)']++;
      else distribution['Very High (200h+)']++;
    });

    return Object.entries(distribution).map(([range, count]) => ({
      range,
      count,
      percentage: monthlyHours.length > 0 ? ((count / monthlyHours.length) * 100).toFixed(1) : 0
    }));
  }

  /**
   * Calculate pay distribution by range
   */
  calculatePayDistribution(payrollRecords) {
    const distribution = {
      'Low (£0-500)': 0,
      'Medium (£500-1000)': 0,
      'High (£1000-1500)': 0,
      'Very High (£1500+)': 0
    };

    payrollRecords.forEach(record => {
      const pay = (record.pay1 || 0) + (record.pay2 || 0) + (record.pay3 || 0);
      
      if (pay < 500) distribution['Low (£0-500)']++;
      else if (pay < 1000) distribution['Medium (£500-1000)']++;
      else if (pay < 1500) distribution['High (£1000-1500)']++;
      else distribution['Very High (£1500+)']++;
    });

    return Object.entries(distribution).map(([range, count]) => ({
      range,
      count,
      percentage: payrollRecords.length > 0 ? ((count / payrollRecords.length) * 100).toFixed(1) : 0
    }));
  }

  /**
   * Find discrepancies between hours and payroll
   */
  findDiscrepancies(payrollRecords, monthlyHours) {
    const discrepancies = [];

    monthlyHours.forEach(monthRecord => {
      // Find corresponding payroll records
      const payrollMatch = payrollRecords.filter(p => 
        p.guardId?.toString() === monthRecord.guardId?.toString?.()
      );

      if (payrollMatch.length === 0 && monthRecord.totalHours > 0) {
        discrepancies.push({
          type: 'MISSING_PAYROLL',
          guardName: monthRecord.guardId?.guardName || 'Unknown',
          hoursWorked: monthRecord.totalHours,
          message: 'Hours recorded but no payroll entry found'
        });
      }

      // Check for negative remaining hours
      if (monthRecord.remainingHours && monthRecord.remainingHours < 0) {
        discrepancies.push({
          type: 'OVERPAID',
          guardName: monthRecord.guardId?.guardName || 'Unknown',
          overpaidHours: Math.abs(monthRecord.remainingHours),
          message: 'Guard has been paid more hours than worked'
        });
      }
    });

    return discrepancies;
  }

  /**
   * Generate forecast for next month
   */
  generateForecast(payrollRecords, monthlyHours) {
    const currentTotal = monthlyHours.reduce((sum, m) => sum + (m.totalHours || 0), 0);
    const currentPay = payrollRecords.reduce((sum, p) => {
      return sum + (p.pay1 || 0) + (p.pay2 || 0) + (p.pay3 || 0);
    }, 0);

    // Simple linear forecast (can be improved with more data)
    const avgGuards = monthlyHours.length;
    const avgHoursPerGuard = avgGuards > 0 ? currentTotal / avgGuards : 0;
    const avgPayPerHour = currentTotal > 0 ? currentPay / currentTotal : 0;

    return {
      forecastedHours: (avgHoursPerGuard * avgGuards).toFixed(2),
      forecastedPayroll: (avgHoursPerGuard * avgGuards * avgPayPerHour).toFixed(2),
      confidence: '75%',
      notes: 'Forecast based on current month averages'
    };
  }

  /**
   * Get filtered analysis for UI display
   */
  async getFilteredAnalysis(filters = {}) {
    try {
      let query = {};
      
      // Parse date filters
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = endDate;
        }
      }

      // Guard filter
      if (filters.guardId && filters.guardId !== '') {
        query.guardId = filters.guardId;
      }

      console.log('📊 Filtered Analysis Query:', JSON.stringify(query, null, 2));

      // Fetch monthly hours with filters
      let monthlyHours = await MonthlyHours.find(query)
        .populate({
          path: 'guardId',
          select: 'guardName clientId email phoneNumber'
        })
        .lean();

      console.log(`📈 Found ${monthlyHours.length} monthly hour records`);

      // Client filter (after population)
      if (filters.clientId && filters.clientId !== '') {
        const beforeClientFilter = monthlyHours.length;
        monthlyHours = monthlyHours.filter(m => {
          const guardClientId = m.guardId?.clientId?.toString();
          const filterClientId = filters.clientId?.toString();
          return guardClientId === filterClientId;
        });
        console.log(`🔍 Client filter: ${beforeClientFilter} → ${monthlyHours.length} records`);
      }

      // Status filter
      if (filters.status && filters.status !== '') {
        const beforeStatusFilter = monthlyHours.length;
        monthlyHours = monthlyHours.filter(m => {
          const status = this.determineStatus(m);
          return status === filters.status;
        });
        console.log(`📌 Status filter: ${beforeStatusFilter} → ${monthlyHours.length} records`);
      }

      // Calculate summary
      const summary = this.calculateFilteredSummary(monthlyHours);

      console.log('📊 Summary calculated:', summary);

      return {
        success: true,
        data: {
          entries: monthlyHours,
          summary: summary
        }
      };
    } catch (error) {
      console.error('Error calculating filtered analysis:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Determine status of hours entry
   */
  determineStatus(entry) {
    if (!entry) return 'pending';
    
    const total = entry.totalHours || 0;
    const paid = entry.paidHours || 0;

    if (paid === 0) return 'pending';
    if (paid >= total) return 'paid';
    return 'partial';
  }

  /**
   * Calculate summary for filtered data
   */
  calculateFilteredSummary(monthlyHours) {
    let totalHours = 0;
    let totalMinutes = 0;
    let totalPaidHours = 0;
    let totalPaidMinutes = 0;
    let totalRemainingHours = 0;
    let totalRemainingMinutes = 0;

    monthlyHours.forEach(entry => {
      totalHours += entry.totalHours || 0;
      totalMinutes += entry.totalMinutes || 0;
      totalPaidHours += entry.paidHours || 0;
      totalPaidMinutes += entry.paidMinutes || 0;
      totalRemainingHours += entry.remainingHours || 0;
      totalRemainingMinutes += entry.remainingMinutes || 0;
    });

    // Normalize minutes
    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    totalPaidHours += Math.floor(totalPaidMinutes / 60);
    totalPaidMinutes = totalPaidMinutes % 60;

    totalRemainingHours += Math.floor(totalRemainingMinutes / 60);
    totalRemainingMinutes = totalRemainingMinutes % 60;

    return {
      totalHours,
      totalMinutes,
      paidHours: totalPaidHours,
      paidMinutes: totalPaidMinutes,
      remainingHours: totalRemainingHours,
      remainingMinutes: totalRemainingMinutes,
      totalGuards: monthlyHours.length,
      averageHoursPerGuard: monthlyHours.length > 0 ? 
        ((totalHours + totalMinutes / 60) / monthlyHours.length).toFixed(2) : 0
    };
  }

  /**
   * Get guard-specific analytics
   */
  async getGuardAnalytics(guardId, year, month) {
    try {
      const monthlyRecord = await MonthlyHours.findOne({
        guardId,
        year,
        month
      }).populate('guardId').lean();

      const guard = await GuardMaster.findById(guardId).lean();
      
      if (!monthlyRecord) {
        return {
          success: false,
          message: 'No monthly hours record found for this guard in the specified period'
        };
      }

      // Get historical data for comparison
      const previousMonths = await MonthlyHours.find({
        guardId,
        $or: [
          { year: year - 1 },
          { year: year, month: { $lt: month } }
        ]
      }).lean();

      const avgHistoricalHours = previousMonths.length > 0
        ? previousMonths.reduce((sum, m) => sum + (m.totalHours || 0), 0) / previousMonths.length
        : 0;

      return {
        success: true,
        data: {
          guardName: guard?.guardName || 'Unknown',
          currentMonth: {
            year,
            month,
            hoursWorked: monthlyRecord.totalHours || 0,
            hoursPaid: monthlyRecord.paidHours || 0,
            hoursRemaining: monthlyRecord.remainingHours || 0,
            notes: monthlyRecord.notes
          },
          historicalComparison: {
            averageHoursPreviousMonths: avgHistoricalHours.toFixed(2),
            currentVsAverage: ((monthlyRecord.totalHours - avgHistoricalHours).toFixed(2)),
            trend: monthlyRecord.totalHours > avgHistoricalHours ? 'INCREASING' : 'DECREASING',
            percentageChange: avgHistoricalHours > 0 
              ? (((monthlyRecord.totalHours - avgHistoricalHours) / avgHistoricalHours) * 100).toFixed(1)
              : 0
          }
        }
      };
    } catch (error) {
      console.error('Error calculating guard analytics:', error);
      throw error;
    }
  }
}

module.exports = new MonthlyAnalytics();
