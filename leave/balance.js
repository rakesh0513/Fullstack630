// Leave Balance Management Module
// Handles per-employee leave balance tracking using LeaveBalances collection

const { MongoClient } = require('mongodb');
const url = require('../url');
const { LEAVE_TYPES } = require('./types');

const DEFAULT_BALANCES = {};

// Initialize default balances from leave type config
Object.keys(LEAVE_TYPES).forEach(type => {
  DEFAULT_BALANCES[type] = LEAVE_TYPES[type].maxPerYear;
});

/**
 * Get or initialize leave balance for an employee
 * @param {string} employeeName
 * @returns {Promise<Object>} balance object { annual, sick, personal }
 */
async function getBalance(employeeName) {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('nodeedb');
    const collection = db.collection('LeaveBalances');

    let balance = await collection.findOne({ employeeName });

    if (!balance) {
      // Initialize with default balances
      const newBalance = {
        employeeName,
        ...DEFAULT_BALANCES,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await collection.insertOne(newBalance);
      balance = newBalance;
    }

    return {
      employeeName: balance.employeeName,
      annual: balance.annual || 0,
      sick: balance.sick || 0,
      personal: balance.personal || 0
    };
  } finally {
    await client.close();
  }
}

/**
 * Deduct leave days from employee balance (on approval)
 * @param {string} employeeName
 * @param {string} leaveType
 * @param {number} days
 * @returns {Promise<Object>} updated balance
 */
async function deductBalance(employeeName, leaveType, days) {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('nodeedb');
    const collection = db.collection('LeaveBalances');

    // First ensure balance record exists
    await getBalance(employeeName);

    const result = await collection.findOneAndUpdate(
      { employeeName },
      { $inc: { [leaveType]: -days }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return {
      employeeName: result.employeeName,
      annual: result.annual || 0,
      sick: result.sick || 0,
      personal: result.personal || 0
    };
  } finally {
    await client.close();
  }
}

/**
 * Add leave days back to employee balance (on rejection/cancellation)
 * @param {string} employeeName
 * @param {string} leaveType
 * @param {number} days
 * @returns {Promise<Object>} updated balance
 */
async function addBackBalance(employeeName, leaveType, days) {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('nodeedb');
    const collection = db.collection('LeaveBalances');

    // First ensure balance record exists
    await getBalance(employeeName);

    const result = await collection.findOneAndUpdate(
      { employeeName },
      { $inc: { [leaveType]: days }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return {
      employeeName: result.employeeName,
      annual: result.annual || 0,
      sick: result.sick || 0,
      personal: result.personal || 0
    };
  } finally {
    await client.close();
  }
}

/**
 * Check if employee has sufficient balance for a leave request
 * @param {string} employeeName
 * @param {string} leaveType
 * @param {number} days
 * @returns {Promise<{ sufficient: boolean, balance: number, available: number }>}
 */
async function hasSufficientBalance(employeeName, leaveType, days) {
  const balance = await getBalance(employeeName);
  const available = balance[leaveType] || 0;
  return {
    sufficient: available >= days,
    balance: available,
    available,
    requested: days
  };
}

module.exports = {
  getBalance,
  deductBalance,
  addBackBalance,
  hasSufficientBalance
};