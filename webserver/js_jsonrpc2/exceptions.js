//Copyright (c) 2013 Ruben LZ Tan
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

function inherits(ctor, superCtor) {
  ctor.prototype = Object.create(superCtor.prototype);
  ctor.prototype.constructor = ctor;
  ctor.super_ = superCtor;
}

function JsonRpcError(msg) {
  this.name    = 'JsonRpcError';
  this.code    = -32603;
  this.message = msg;
  this.data    = Array.prototype.slice.call(arguments, 1);
}
JsonRpcError.prototype = Object.create(Error.prototype);
JsonRpcError.prototype.serialize = function serialize() {
  return JSON.stringify({
    name    : this.name,
    message : this.message,
    code    : this.code,
    data    : this.data
  });
};

function ParseError() {
  JsonRpcError.call(this, 'Unable to parse payload as a JSON.');
  this.name = 'ParseError';
  this.code = -32700;
  this.data = Array.prototype.slice.call(arguments);
}
inherits(ParseError, JsonRpcError);

function InvalidRequestError() {
  JsonRpcError.call(this, 'The request object is not a valid JSON-RPC 2.0 object.');
  this.name = 'InvalidRequestError';
  this.code = -32600;
  this.data = Array.prototype.slice.call(arguments);
}
inherits(InvalidRequestError, JsonRpcError);

function MethodNotFoundError() {
  JsonRpcError.call(this, 'The JSON-RPC method does not exist, or is an invalid one.');
  this.name = 'MethodNotFoundError';
  this.code = -32601;
  this.data = Array.prototype.slice.call(arguments);
}
inherits(MethodNotFoundError, JsonRpcError);

function InvalidParamsError() {
  JsonRpcError.call(this, "The JSON-RPC method's parameters are invalid.");
  this.name = 'InvalidParamsError';
  this.code = -32602;
  this.data = Array.prototype.slice.call(arguments);
}
inherits(InvalidParamsError, JsonRpcError);

export {
  JsonRpcError,
  ParseError,
  InvalidRequestError,
  MethodNotFoundError,
  InvalidParamsError
};
