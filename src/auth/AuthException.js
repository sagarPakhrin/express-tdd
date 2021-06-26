module.exports = function UserNotFoundException() {
  this.status = 401;
  this.message = 'incorrect_credentials';
};
