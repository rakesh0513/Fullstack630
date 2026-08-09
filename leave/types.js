// Leave Type Configuration
// Defines available leave types, maximum days per year, and maximum days per request

const LEAVE_TYPES = {
  annual: {
    label: 'Annual Leave',
    maxPerYear: 20,
    maxPerRequest: 30,
    description: 'Planned time off for vacation or personal reasons'
  },
  sick: {
    label: 'Sick Leave',
    maxPerYear: 10,
    maxPerRequest: 10,
    description: 'Time off due to illness or medical appointments'
  },
  personal: {
    label: 'Personal Leave',
    maxPerYear: 5,
    maxPerRequest: 5,
    description: 'Time off for personal or family matters'
  }
};

const VALID_LEAVE_TYPES = Object.keys(LEAVE_TYPES);

function getLeaveTypeConfig(type) {
  return LEAVE_TYPES[type] || null;
}

function isValidLeaveType(type) {
  return VALID_LEAVE_TYPES.includes(type);
}

module.exports = {
  LEAVE_TYPES,
  VALID_LEAVE_TYPES,
  getLeaveTypeConfig,
  isValidLeaveType
};