//Copyright (c) 2013 Ruben LZ Tan
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import * as exception from './exceptions.js';

var isString = function(obj) {
  return typeof(obj) === 'string'
}

var isNumber = function(obj) {
  return typeof(obj) === 'number'
}

var isObject = function(obj) {
  return typeof(obj) === 'object'
}

var isNull = function(obj) {
  return obj === null
}

var isArray = function(obj) {
  return Array.isArray(obj)
}

function _validateMessageStructure(type, data) {
  var errors = []

  function checkId(id) {
    if (!isString(id) && (!isNumber(id) || (isNumber(id) && id % 1 !== 0))) {
      errors.push('An ID must be provided. It must be either a string or an integer (no fractions allowed)')
    }
  }

  function checkErrorId(id) {
    if (!isNull(id) && !isString(id) && (!isNumber(id) || (isNumber(id) && id % 1 !== 0))) {
      errors.push('An ID must be provided. It must be either a string or an integer (no fractions allowed)')
    }
  }

  function checkMethod(method) {
    if (!isString(data.method)) {
      errors.push('Method should be a string. Received ' + typeof data.method + ' instead')
    }
  }

  function checkResult(result) {
    if (undefined === result) {
      errors.push('Result must exist for success Response objects')
    }
  }

  function checkError(error) {
    if (!isObject(error)) {
      errors.push('Error must be an object conforming to the JSON-RPC 2.0 error object specs')
      return
    }

    if (!(error instanceof jsonrpc.err.JsonRpcError)) {
      errors.push('Error must be an instance of JsonRpcError, or any derivatives of it')
      return
    }

    var code    = error.code
    var message = error.message

    if (!isNumber(code) && (isNumber(code) && code % 1 !== 0)) {
      errors.push('Invalid error code. It MUST be an integer.')
    }

    if (!isString(message)) {
      errors.push('Message must exist or must be a string.')
    }
  }

  switch (type) {
    case 'request' :
      checkId(data.id)
      checkMethod(data.method)
      break

    case 'notification' :
      checkMethod(data.method)
      break

    case 'success' :
      checkId(data.id)
      checkResult(data.result)
      break

    case 'error' :
      checkErrorId(data.id)
      checkError(data.error)
      break
  }

  return (errors.length > 0) ? errors : null
}

export const jsonrpc = {
  err          : exception,       // custom error types
  errorHandler : null,            // custom error handler

  request : function (id, method, params) {
    if (params && !isObject(params) && !isArray(params)) {
      params = [params];
    }

    var errors = _validateMessageStructure('request', {
      id     : id,
      method : method,
      params : params
    })

    if (errors) {
      if (this.errorHandler) {
        this.errorHandler(errors)
      }
      return errors
    }

    return JSON.stringify(this.requestObject(id, method, params))
  },

  requestObject : function (id, method, params) {
    var req = { 
      jsonrpc : '2.0',
      id      : id,
      method  : method
    }
    if (params) {
      req.params = params
    }
    return req
  },

  notification : function (method, params) {
    var errors = _validateMessageStructure('notification', {
      method : method,
      params : params
    })

    if (errors) {
      if (this.errorHandler) {
        this.errorHandler(errors)
      }
      return errors;
    }
    return JSON.stringify(this.notificationObject(method, params))
  },

  notificationObject : function (method, params) {      
    var notification = { 
      jsonrpc : '2.0',
      method  : method
    }
    if (params) {
      notification.params = params
    }
    return notification
  },

  success : function (id, result) {
    var errors = _validateMessageStructure('success', {
      id     : id,
      result : result
    })
    if (errors) {
      if (this.errorHandler) {
        this.errorHandler(errors);
      }
      return errors
    }
    return JSON.stringify(this.successObject(id, result))
  },

  successObject : function (id, result) {
    var success = { 
      jsonrpc : '2.0',
      id      : id,
      result  : result
    }
    return success
  },

  error : function (id, errdata) {
    var errors = _validateMessageStructure('error', {
      id    : id,
      error : errdata
    })
    if (errors) {
      if (this.errorHandler) {
        this.errorHandler(errors)
      }
      return errors
    }
    return JSON.stringify(this.errorObject(id, errdata))
  },

  errorObject : function (id, errdata) {
    var error = {
      jsonrpc : '2.0',
      id      : id,
      error   : errdata
    }
    return error
  },

  deserialize : function (msg) {
    var obj = null
    try {
      obj = JSON.parse(msg)
    } catch(err) {
      if (this.errorHandler) {
        this.errorHandler(msg)
      }
      return new jsonrpc.err.ParseError(msg)
    }
    return this.deserializeObject(obj)
  },

  deserializeObject : function (obj) {
    if (obj.jsonrpc !== '2.0') {
      if (this.errorHandler) {
        this.errorHandler(obj)
      }
      return new jsonrpc.err.InvalidRequestError(obj)
    }
    if (obj.id === void 0) {
      return {
        type    : 'notification',
        payload : {
          method : obj.method,
          params : obj.params
        }
      }
    }
    if (isString(obj.method)) {
      return {
        type    : 'request',
        payload : {
          id     : obj.id,
          method : obj.method,
          params : obj.params
        }
      }
    }
    if (obj.hasOwnProperty('result')) {
      return {
        type    : 'success',
        payload : {
          id     : obj.id,
          result : obj.result
        }
      }
    }
    if (obj.error) {
      return {
        type    : 'error',
        payload : {
          id    : obj.id,
          error : obj.error
        }
      }
    }
    if (this.errorHandler) {
      this.errorHandler(obj)
    }
    return new jsonrpc.err.InvalidRequestError(obj)
  }
}
