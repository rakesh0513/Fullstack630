// Employee Leave Management Module
// Enhanced with async/await, validation, balance tracking, status workflow, and statistics
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const url = require('../url');
const { isValidLeaveType, getLeaveTypeConfig, VALID_LEAVE_TYPES } = require('./types');
const { getBalance, deductBalance, addBackBalance, hasSufficientBalance } = require('./balance');

const router = express.Router();

// ---------- Helper Functions ----------

/**
 * Calculate number of days between two dates (inclusive)
 */
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

/**
 * Validate a leave request input
 * Returns { valid: boolean, errors: string[] }
 */
function validateLeaveInput(body) {
  const errors = [];
  const { employeeName, leaveType, startDate, endDate, reason } = body;

  if (!employeeName || typeof employeeName !== 'string' || employeeName.trim() === '') {
    errors.push('Employee name is required');
  }

  if (!leaveType || !isValidLeaveType(leaveType)) {
    errors.push(`Invalid leave type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}`);
  }

  if (!startDate) {
    errors.push('Start date is required');
  }

  if (!endDate) {
    errors.push('End date is required');
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      errors.push('Start date is invalid');
    }
    if (isNaN(end.getTime())) {
      errors.push('End date is invalid');
    }

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (start > end) {
        errors.push('Start date must be before or equal to end date');
      } else {
        const days = calculateDays(startDate, endDate);
        if (leaveType && isValidLeaveType(leaveType)) {
          const config = getLeaveTypeConfig(leaveType);
          if (days > config.maxPerRequest) {
            errors.push(`Leave request cannot exceed ${config.maxPerRequest} days for ${leaveType} leave`);
          }
        }
      }
    }
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    errors.push('Reason is required');
  } else if (reason.length > 500) {
    errors.push('Reason cannot exceed 500 characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check for overlapping leave requests for the same employee
 */
async function checkOverlappingLeaves(employeeName, startDate, endDate, excludeId = null) {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('nodeedb');
    const leavesCollection = db.collection('Leaves');

    const query = {
      employeeName,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    };

    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) };
    }

    const existing = await leavesCollection.findOne(query);
    return !!existing;
  } finally {
    await client.close();
  }
}

/**
 * Connect to MongoDB and return the db instance
 */
async function connectToDb() {
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('nodeedb');
  return { client, db };
}

// ---------- Routes ----------

// GET / - Fetch all leaves (with optional employeeName filter)
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await connectToDb();
    const { db } = connection;
    const leavesCollection = db.collection('Leaves');

    const filter = {};
    if (req.query.employeeName) {
      filter.employeeName = req.query.employeeName;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const leaves = await leavesCollection.find(filter).sort({ createdAt: -1 }).toArray();
    res.json(leaves);
  } catch (err) {
    console.error('Error fetching leaves:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) await connection.client.close();
  }
});

// GET /balance - Get leave balance for an employee
router.get('/balance', async (req, res) => {
  try {
    const employeeName = req.query.employeeName;
    if (!employeeName) {
      return res.status(400).json({ error: 'employeeName query parameter is required' });
    }
    const balance = await getBalance(employeeName);
    res.json(balance);
  } catch (err) {
    console.error('Error fetching balance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats - Get aggregated leave statistics
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await connectToDb();
    const { db } = connection;
    const leavesCollection = db.collection('Leaves');

    // Total leaves by type and status
    const stats = await leavesCollection.aggregate([
      {
        $group: {
          _id: { leaveType: '$leaveType', status: '$status' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.leaveType',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      }
    ]).toArray();

    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) await connection.client.close();
  }
});

// POST /insert - Create a new leave request
router.post('/insert', async (req, res) => {
  let connection;
  try {
    const { employeeName, leaveType, startDate, endDate, reason } = req.body;

    // Validate input
    const validation = validateLeaveInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    // Calculate days
    const days = calculateDays(startDate, endDate);

    // Check for overlapping leaves
    const hasOverlap = await checkOverlappingLeaves(employeeName, startDate, endDate);
    if (hasOverlap) {
      return res.status(400).json({ error: 'Leave request overlaps with an existing approved or pending leave' });
    }

    // Check sufficient balance (will be checked again on approval)
    const balanceCheck = await hasSufficientBalance(employeeName, leaveType, days);
    if (!balanceCheck.sufficient) {
      return res.status(400).json({
        error: 'Insufficient leave balance',
        details: `Available ${leaveType} balance: ${balanceCheck.available} days, requested: ${days} days`
      });
    }

    connection = await connectToDb();
    const { db } = connection;
    const leavesCollection = db.collection('Leaves');

    const leaveDoc = {
      employeeName: employeeName.trim(),
      leaveType,
      startDate,
      endDate,
      days,
      status: 'Pending',
      reason: reason.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await leavesCollection.insertOne(leaveDoc);
    console.log('Leave request created');
    res.status(201).json({
      message: 'Leave request submitted successfully',
      leaveId: result.insertedId,
      status: 'Pending'
    });
  } catch (err) {
    console.error('Error creating leave:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) await connection.client.close();
  }
});

// POST /update - Update leave status (approve/reject/cancel)
router.post('/update', async (req, res) => {
  let connection;
  try {
    const { _id, status } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'Leave ID (_id) is required' });
    }

    const validStatuses = ['Approved', 'Rejected', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    connection = await connectToDb();
    const { db } = connection;
    const leavesCollection = db.collection('Leaves');

    // Find the existing leave
    const existingLeave = await leavesCollection.findOne({ _id: new ObjectId(_id) });
    if (!existingLeave) {
      return res.status(404).json({ error: 'Leave record not found' });
    }

    if (existingLeave.status === 'Cancelled') {
      return res.status(400).json({ error: 'Cannot update a cancelled leave' });
    }

    if (existingLeave.status === 'Approved' && status === 'Cancelled') {
      // Allow admin to cancel approved leaves
      // Add back balance
      await addBackBalance(existingLeave.employeeName, existingLeave.leaveType, existingLeave.days);
    }

    if (status === 'Approved') {
      // Deduct balance on approval
      await deductBalance(existingLeave.employeeName, existingLeave.leaveType, existingLeave.days);
    }

    if (status === 'Rejected' || status === 'Cancelled') {
      // Add days back if previously approved
      await addBackBalance(existingLeave.employeeName, existingLeave.leaveType, existingLeave.days);
    }

    // Update the leave status
    const result = await leavesCollection.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Leave record not found' });
    }

    console.log(`Leave ${status.toLowerCase()}`);
    res.json({
      message: `Leave request ${status.toLowerCase()} successfully`,
      status
    });
  } catch (err) {
    console.error('Error updating leave:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) await connection.client.close();
  }
});

// POST /delete - Delete a leave request
router.post('/delete', async (req, res) => {
  let connection;
  try {
    const _id = req.body._id;
    if (!_id) {
      return res.status(400).json({ error: 'Leave ID (_id) is required' });
    }

    connection = await connectToDb();
    const { db } = connection;
    const leavesCollection = db.collection('Leaves');

    // Find leave before deleting to handle balance
    const existingLeave = await leavesCollection.findOne({ _id: new ObjectId(_id) });
    if (!existingLeave) {
      return res.status(404).json({ error: 'Leave record not found' });
    }

    // If the leave was approved, add days back to balance
    if (existingLeave.status === 'Approved') {
      await addBackBalance(existingLeave.employeeName, existingLeave.leaveType, existingLeave.days);
    }

    const result = await leavesCollection.deleteOne({ _id: new ObjectId(_id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Leave record not found' });
    }

    console.log('Leave deleted');
    res.json({ message: 'Leave request deleted successfully' });
  } catch (err) {
    console.error('Error deleting leave:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) await connection.client.close();
  }
});

module.exports = router;