module.exports = function UserNotFoundException() {
  this.status = 403;
  this.message = 'inactive_auth_failure';
};
