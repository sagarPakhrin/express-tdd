module.exports = function UserNotFoundException(message) {
  this.status = 403;
  this.message = message ? message : 'inactive_auth_failure';
};
