module.exports = function ValidationException(errors) {
  this.errors = errors;
  this.status = 400;
};
