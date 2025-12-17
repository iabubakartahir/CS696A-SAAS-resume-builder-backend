export default class ApiResponse {
  constructor(statusCode, data, message = "success") {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}
