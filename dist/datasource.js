System.registerDynamic('jsep', [], true, function ($__require, exports, module) {
	var global = this || self,
	    GLOBAL = global;
	//     JavaScript Expression Parser (JSEP) <%= version %>
	//     JSEP may be freely distributed under the MIT License
	//     http://jsep.from.so/

	/*global module: true, exports: true, console: true */
	(function (root) {
		'use strict';
		// Node Types
		// ----------

		// This is the full set of types that any JSEP node can be.
		// Store them here to save space when minified

		var COMPOUND = 'Compound',
		    IDENTIFIER = 'Identifier',
		    MEMBER_EXP = 'MemberExpression',
		    LITERAL = 'Literal',
		    THIS_EXP = 'ThisExpression',
		    CALL_EXP = 'CallExpression',
		    UNARY_EXP = 'UnaryExpression',
		    BINARY_EXP = 'BinaryExpression',
		    LOGICAL_EXP = 'LogicalExpression',
		    CONDITIONAL_EXP = 'ConditionalExpression',
		    ARRAY_EXP = 'ArrayExpression',
		    PERIOD_CODE = 46,
		    // '.'
		COMMA_CODE = 44,
		    // ','
		SQUOTE_CODE = 39,
		    // single quote
		DQUOTE_CODE = 34,
		    // double quotes
		OPAREN_CODE = 40,
		    // (
		CPAREN_CODE = 41,
		    // )
		OBRACK_CODE = 91,
		    // [
		CBRACK_CODE = 93,
		    // ]
		QUMARK_CODE = 63,
		    // ?
		SEMCOL_CODE = 59,
		    // ;
		COLON_CODE = 58,
		    // :

		throwError = function (message, index) {
			var error = new Error(message + ' at character ' + index);
			error.index = index;
			error.description = message;
			throw error;
		},


		// Operations
		// ----------

		// Set `t` to `true` to save space (when minified, not gzipped)
		t = true,

		// Use a quickly-accessible map to store all of the unary operators
		// Values are set to `true` (it really doesn't matter)
		unary_ops = { '-': t, '!': t, '~': t, '+': t },

		// Also use a map for the binary operations but set their values to their
		// binary precedence for quick reference:
		// see [Order of operations](http://en.wikipedia.org/wiki/Order_of_operations#Programming_language)
		binary_ops = {
			'||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
			'==': 6, '!=': 6, '===': 6, '!==': 6,
			'<': 7, '>': 7, '<=': 7, '>=': 7,
			'<<': 8, '>>': 8, '>>>': 8,
			'+': 9, '-': 9,
			'*': 10, '/': 10, '%': 10
		},

		// Get return the longest key length of any object
		getMaxKeyLen = function (obj) {
			var max_len = 0,
			    len;
			for (var key in obj) {
				if ((len = key.length) > max_len && obj.hasOwnProperty(key)) {
					max_len = len;
				}
			}
			return max_len;
		},
		    max_unop_len = getMaxKeyLen(unary_ops),
		    max_binop_len = getMaxKeyLen(binary_ops),

		// Literals
		// ----------
		// Store the values to return for the various literals we may encounter
		literals = {
			'true': true,
			'false': false,
			'null': null
		},

		// Except for `this`, which is special. This could be changed to something like `'self'` as well
		this_str = 'this',

		// Returns the precedence of a binary operator or `0` if it isn't a binary operator
		binaryPrecedence = function (op_val) {
			return binary_ops[op_val] || 0;
		},

		// Utility function (gets called from multiple places)
		// Also note that `a && b` and `a || b` are *logical* expressions, not binary expressions
		createBinaryExpression = function (operator, left, right) {
			var type = operator === '||' || operator === '&&' ? LOGICAL_EXP : BINARY_EXP;
			return {
				type: type,
				operator: operator,
				left: left,
				right: right
			};
		},

		// `ch` is a character code in the next three functions
		isDecimalDigit = function (ch) {
			return ch >= 48 && ch <= 57; // 0...9
		},
		    isIdentifierStart = function (ch) {
			return ch === 36 || ch === 95 || // `$` and `_`
			ch >= 65 && ch <= 90 || // A...Z
			ch >= 97 && ch <= 122 || // a...z
			ch >= 128 && !binary_ops[String.fromCharCode(ch)]; // any non-ASCII that is not an operator
		},
		    isIdentifierPart = function (ch) {
			return ch === 36 || ch === 95 || // `$` and `_`
			ch >= 65 && ch <= 90 || // A...Z
			ch >= 97 && ch <= 122 || // a...z
			ch >= 48 && ch <= 57 || // 0...9
			ch >= 128 && !binary_ops[String.fromCharCode(ch)]; // any non-ASCII that is not an operator
		},


		// Parsing
		// -------
		// `expr` is a string with the passed in expression
		jsep = function (expr) {
			// `index` stores the character number we are currently at while `length` is a constant
			// All of the gobbles below will modify `index` as we move along
			var index = 0,
			    charAtFunc = expr.charAt,
			    charCodeAtFunc = expr.charCodeAt,
			    exprI = function (i) {
				return charAtFunc.call(expr, i);
			},
			    exprICode = function (i) {
				return charCodeAtFunc.call(expr, i);
			},
			    length = expr.length,


			// Push `index` up to the next non-space character
			gobbleSpaces = function () {
				var ch = exprICode(index);
				// space or tab
				while (ch === 32 || ch === 9) {
					ch = exprICode(++index);
				}
			},


			// The main parsing function. Much of this code is dedicated to ternary expressions
			gobbleExpression = function () {
				var test = gobbleBinaryExpression(),
				    consequent,
				    alternate;
				gobbleSpaces();
				if (exprICode(index) === QUMARK_CODE) {
					// Ternary expression: test ? consequent : alternate
					index++;
					consequent = gobbleExpression();
					if (!consequent) {
						throwError('Expected expression', index);
					}
					gobbleSpaces();
					if (exprICode(index) === COLON_CODE) {
						index++;
						alternate = gobbleExpression();
						if (!alternate) {
							throwError('Expected expression', index);
						}
						return {
							type: CONDITIONAL_EXP,
							test: test,
							consequent: consequent,
							alternate: alternate
						};
					} else {
						throwError('Expected :', index);
					}
				} else {
					return test;
				}
			},


			// Search for the operation portion of the string (e.g. `+`, `===`)
			// Start by taking the longest possible binary operations (3 characters: `===`, `!==`, `>>>`)
			// and move down from 3 to 2 to 1 character until a matching binary operation is found
			// then, return that binary operation
			gobbleBinaryOp = function () {
				gobbleSpaces();
				var biop,
				    to_check = expr.substr(index, max_binop_len),
				    tc_len = to_check.length;
				while (tc_len > 0) {
					if (binary_ops.hasOwnProperty(to_check)) {
						index += tc_len;
						return to_check;
					}
					to_check = to_check.substr(0, --tc_len);
				}
				return false;
			},


			// This function is responsible for gobbling an individual expression,
			// e.g. `1`, `1+2`, `a+(b*2)-Math.sqrt(2)`
			gobbleBinaryExpression = function () {
				var ch_i, node, biop, prec, stack, biop_info, left, right, i;

				// First, try to get the leftmost thing
				// Then, check to see if there's a binary operator operating on that leftmost thing
				left = gobbleToken();
				biop = gobbleBinaryOp();

				// If there wasn't a binary operator, just return the leftmost node
				if (!biop) {
					return left;
				}

				// Otherwise, we need to start a stack to properly place the binary operations in their
				// precedence structure
				biop_info = { value: biop, prec: binaryPrecedence(biop) };

				right = gobbleToken();
				if (!right) {
					throwError("Expected expression after " + biop, index);
				}
				stack = [left, biop_info, right];

				// Properly deal with precedence using [recursive descent](http://www.engr.mun.ca/~theo/Misc/exp_parsing.htm)
				while (biop = gobbleBinaryOp()) {
					prec = binaryPrecedence(biop);

					if (prec === 0) {
						break;
					}
					biop_info = { value: biop, prec: prec };

					// Reduce: make a binary expression from the three topmost entries.
					while (stack.length > 2 && prec <= stack[stack.length - 2].prec) {
						right = stack.pop();
						biop = stack.pop().value;
						left = stack.pop();
						node = createBinaryExpression(biop, left, right);
						stack.push(node);
					}

					node = gobbleToken();
					if (!node) {
						throwError("Expected expression after " + biop, index);
					}
					stack.push(biop_info, node);
				}

				i = stack.length - 1;
				node = stack[i];
				while (i > 1) {
					node = createBinaryExpression(stack[i - 1].value, stack[i - 2], node);
					i -= 2;
				}
				return node;
			},


			// An individual part of a binary expression:
			// e.g. `foo.bar(baz)`, `1`, `"abc"`, `(a % 2)` (because it's in parenthesis)
			gobbleToken = function () {
				var ch, to_check, tc_len;

				gobbleSpaces();
				ch = exprICode(index);

				if (isDecimalDigit(ch) || ch === PERIOD_CODE) {
					// Char code 46 is a dot `.` which can start off a numeric literal
					return gobbleNumericLiteral();
				} else if (ch === SQUOTE_CODE || ch === DQUOTE_CODE) {
					// Single or double quotes
					return gobbleStringLiteral();
				} else if (isIdentifierStart(ch) || ch === OPAREN_CODE) {
					// open parenthesis
					// `foo`, `bar.baz`
					return gobbleVariable();
				} else if (ch === OBRACK_CODE) {
					return gobbleArray();
				} else {
					to_check = expr.substr(index, max_unop_len);
					tc_len = to_check.length;
					while (tc_len > 0) {
						if (unary_ops.hasOwnProperty(to_check)) {
							index += tc_len;
							return {
								type: UNARY_EXP,
								operator: to_check,
								argument: gobbleToken(),
								prefix: true
							};
						}
						to_check = to_check.substr(0, --tc_len);
					}

					return false;
				}
			},

			// Parse simple numeric literals: `12`, `3.4`, `.5`. Do this by using a string to
			// keep track of everything in the numeric literal and then calling `parseFloat` on that string
			gobbleNumericLiteral = function () {
				var number = '',
				    ch,
				    chCode;
				while (isDecimalDigit(exprICode(index))) {
					number += exprI(index++);
				}

				if (exprICode(index) === PERIOD_CODE) {
					// can start with a decimal marker
					number += exprI(index++);

					while (isDecimalDigit(exprICode(index))) {
						number += exprI(index++);
					}
				}

				ch = exprI(index);
				if (ch === 'e' || ch === 'E') {
					// exponent marker
					number += exprI(index++);
					ch = exprI(index);
					if (ch === '+' || ch === '-') {
						// exponent sign
						number += exprI(index++);
					}
					while (isDecimalDigit(exprICode(index))) {
						//exponent itself
						number += exprI(index++);
					}
					if (!isDecimalDigit(exprICode(index - 1))) {
						throwError('Expected exponent (' + number + exprI(index) + ')', index);
					}
				}

				chCode = exprICode(index);
				// Check to make sure this isn't a variable name that start with a number (123abc)
				if (isIdentifierStart(chCode)) {
					throwError('Variable names cannot start with a number (' + number + exprI(index) + ')', index);
				} else if (chCode === PERIOD_CODE) {
					throwError('Unexpected period', index);
				}

				return {
					type: LITERAL,
					value: parseFloat(number),
					raw: number
				};
			},


			// Parses a string literal, staring with single or double quotes with basic support for escape codes
			// e.g. `"hello world"`, `'this is\nJSEP'`
			gobbleStringLiteral = function () {
				var str = '',
				    quote = exprI(index++),
				    closed = false,
				    ch;

				while (index < length) {
					ch = exprI(index++);
					if (ch === quote) {
						closed = true;
						break;
					} else if (ch === '\\') {
						// Check for all of the common escape codes
						ch = exprI(index++);
						switch (ch) {
							case 'n':
								str += '\n';break;
							case 'r':
								str += '\r';break;
							case 't':
								str += '\t';break;
							case 'b':
								str += '\b';break;
							case 'f':
								str += '\f';break;
							case 'v':
								str += '\x0B';break;
							default:
								str += '\\' + ch;
						}
					} else {
						str += ch;
					}
				}

				if (!closed) {
					throwError('Unclosed quote after "' + str + '"', index);
				}

				return {
					type: LITERAL,
					value: str,
					raw: quote + str + quote
				};
			},


			// Gobbles only identifiers
			// e.g.: `foo`, `_value`, `$x1`
			// Also, this function checks if that identifier is a literal:
			// (e.g. `true`, `false`, `null`) or `this`
			gobbleIdentifier = function () {
				var ch = exprICode(index),
				    start = index,
				    identifier;

				if (isIdentifierStart(ch)) {
					index++;
				} else {
					throwError('Unexpected ' + exprI(index), index);
				}

				while (index < length) {
					ch = exprICode(index);
					if (isIdentifierPart(ch)) {
						index++;
					} else {
						break;
					}
				}
				identifier = expr.slice(start, index);

				if (literals.hasOwnProperty(identifier)) {
					return {
						type: LITERAL,
						value: literals[identifier],
						raw: identifier
					};
				} else if (identifier === this_str) {
					return { type: THIS_EXP };
				} else {
					return {
						type: IDENTIFIER,
						name: identifier
					};
				}
			},


			// Gobbles a list of arguments within the context of a function call
			// or array literal. This function also assumes that the opening character
			// `(` or `[` has already been gobbled, and gobbles expressions and commas
			// until the terminator character `)` or `]` is encountered.
			// e.g. `foo(bar, baz)`, `my_func()`, or `[bar, baz]`
			gobbleArguments = function (termination) {
				var ch_i,
				    args = [],
				    node,
				    closed = false;
				while (index < length) {
					gobbleSpaces();
					ch_i = exprICode(index);
					if (ch_i === termination) {
						// done parsing
						closed = true;
						index++;
						break;
					} else if (ch_i === COMMA_CODE) {
						// between expressions
						index++;
					} else {
						node = gobbleExpression();
						if (!node || node.type === COMPOUND) {
							throwError('Expected comma', index);
						}
						args.push(node);
					}
				}
				if (!closed) {
					throwError('Expected ' + String.fromCharCode(termination), index);
				}
				return args;
			},


			// Gobble a non-literal variable name. This variable name may include properties
			// e.g. `foo`, `bar.baz`, `foo['bar'].baz`
			// It also gobbles function calls:
			// e.g. `Math.acos(obj.angle)`
			gobbleVariable = function () {
				var ch_i, node;
				ch_i = exprICode(index);

				if (ch_i === OPAREN_CODE) {
					node = gobbleGroup();
				} else {
					node = gobbleIdentifier();
				}
				gobbleSpaces();
				ch_i = exprICode(index);
				while (ch_i === PERIOD_CODE || ch_i === OBRACK_CODE || ch_i === OPAREN_CODE) {
					index++;
					if (ch_i === PERIOD_CODE) {
						gobbleSpaces();
						node = {
							type: MEMBER_EXP,
							computed: false,
							object: node,
							property: gobbleIdentifier()
						};
					} else if (ch_i === OBRACK_CODE) {
						node = {
							type: MEMBER_EXP,
							computed: true,
							object: node,
							property: gobbleExpression()
						};
						gobbleSpaces();
						ch_i = exprICode(index);
						if (ch_i !== CBRACK_CODE) {
							throwError('Unclosed [', index);
						}
						index++;
					} else if (ch_i === OPAREN_CODE) {
						// A function call is being made; gobble all the arguments
						node = {
							type: CALL_EXP,
							'arguments': gobbleArguments(CPAREN_CODE),
							callee: node
						};
					}
					gobbleSpaces();
					ch_i = exprICode(index);
				}
				return node;
			},


			// Responsible for parsing a group of things within parentheses `()`
			// This function assumes that it needs to gobble the opening parenthesis
			// and then tries to gobble everything within that parenthesis, assuming
			// that the next thing it should see is the close parenthesis. If not,
			// then the expression probably doesn't have a `)`
			gobbleGroup = function () {
				index++;
				var node = gobbleExpression();
				gobbleSpaces();
				if (exprICode(index) === CPAREN_CODE) {
					index++;
					return node;
				} else {
					throwError('Unclosed (', index);
				}
			},


			// Responsible for parsing Array literals `[1, 2, 3]`
			// This function assumes that it needs to gobble the opening bracket
			// and then tries to gobble the expressions as arguments.
			gobbleArray = function () {
				index++;
				return {
					type: ARRAY_EXP,
					elements: gobbleArguments(CBRACK_CODE)
				};
			},
			    nodes = [],
			    ch_i,
			    node;

			while (index < length) {
				ch_i = exprICode(index);

				// Expressions can be separated by semicolons, commas, or just inferred without any
				// separators
				if (ch_i === SEMCOL_CODE || ch_i === COMMA_CODE) {
					index++; // ignore separators
				} else {
					// Try to gobble each expression individually
					if (node = gobbleExpression()) {
						nodes.push(node);
						// If we weren't able to find a binary expression and are out of room, then
						// the expression passed in probably has too much
					} else if (index < length) {
						throwError('Unexpected "' + exprI(index) + '"', index);
					}
				}
			}

			// If there's only one expression just try returning the expression
			if (nodes.length === 1) {
				return nodes[0];
			} else {
				return {
					type: COMPOUND,
					body: nodes
				};
			}
		};

		// To be filled in by the template
		jsep.version = '<%= version %>';
		jsep.toString = function () {
			return 'JavaScript Expression Parser (JSEP) v' + jsep.version;
		};

		/**
   * @method jsep.addUnaryOp
   * @param {string} op_name The name of the unary op to add
   * @return jsep
   */
		jsep.addUnaryOp = function (op_name) {
			max_unop_len = Math.max(op_name.length, max_unop_len);
			unary_ops[op_name] = t;return this;
		};

		/**
   * @method jsep.addBinaryOp
   * @param {string} op_name The name of the binary op to add
   * @param {number} precedence The precedence of the binary op (can be a float)
   * @return jsep
   */
		jsep.addBinaryOp = function (op_name, precedence) {
			max_binop_len = Math.max(op_name.length, max_binop_len);
			binary_ops[op_name] = precedence;
			return this;
		};

		/**
   * @method jsep.addLiteral
   * @param {string} literal_name The name of the literal to add
   * @param {*} literal_value The value of the literal
   * @return jsep
   */
		jsep.addLiteral = function (literal_name, literal_value) {
			literals[literal_name] = literal_value;
			return this;
		};

		/**
   * @method jsep.removeUnaryOp
   * @param {string} op_name The name of the unary op to remove
   * @return jsep
   */
		jsep.removeUnaryOp = function (op_name) {
			delete unary_ops[op_name];
			if (op_name.length === max_unop_len) {
				max_unop_len = getMaxKeyLen(unary_ops);
			}
			return this;
		};

		/**
   * @method jsep.removeBinaryOp
   * @param {string} op_name The name of the binary op to remove
   * @return jsep
   */
		jsep.removeBinaryOp = function (op_name) {
			delete binary_ops[op_name];
			if (op_name.length === max_binop_len) {
				max_binop_len = getMaxKeyLen(binary_ops);
			}
			return this;
		};

		/**
   * @method jsep.removeLiteral
   * @param {string} literal_name The name of the literal to remove
   * @return jsep
   */
		jsep.removeLiteral = function (literal_name) {
			delete literals[literal_name];
			return this;
		};

		// In desktop environments, have a way to restore the old value for `jsep`
		if (typeof exports === 'undefined') {
			var old_jsep = root.jsep;
			// The star of the show! It's a function!
			root.jsep = jsep;
			// And a courteous function willing to move out of the way for other similarly-named objects!
			jsep.noConflict = function () {
				if (root.jsep === jsep) {
					root.jsep = old_jsep;
				}
				return jsep;
			};
		} else {
			// In Node.JS environments
			if (typeof module !== 'undefined' && module.exports) {
				exports = module.exports = jsep;
			} else {
				exports.parse = jsep;
			}
		}
	})(exports);
});
///<reference path="app/headers/common.d.ts" />
///<reference path="jsep.d.ts" />
System.register(['lodash', 'app/core/utils/datemath', 'moment', 'jsep', 'jquery'], function (exports_1, context_1) {
    "use strict";

    var __moduleName = context_1 && context_1.id;
    var lodash_1, dateMath, moment_1, jsep_1, jquery_1;
    var DruidDatasource;
    return {
        setters: [function (lodash_1_1) {
            lodash_1 = lodash_1_1;
        }, function (dateMath_1) {
            dateMath = dateMath_1;
        }, function (moment_1_1) {
            moment_1 = moment_1_1;
        }, function (jsep_1_1) {
            jsep_1 = jsep_1_1;
        }, function (jquery_1_1) {
            jquery_1 = jquery_1_1;
        }],
        execute: function () {
            DruidDatasource = function () {
                /** @ngInject */
                function DruidDatasource(instanceSettings, $q, backendSrv, templateSrv) {
                    this.$q = $q;
                    this.backendSrv = backendSrv;
                    this.templateSrv = templateSrv;
                    this.filterTemplateExpanders = {
                        "selector": lodash_1.default.partialRight(this.replaceTemplateValues, ['value']),
                        "regex": lodash_1.default.partialRight(this.replaceTemplateValues, ['pattern']),
                        "javascript": lodash_1.default.partialRight(this.replaceTemplateValues, ['function']),
                        "in": lodash_1.default.partialRight(this.replaceTemplateValues, ['values'])
                    };
                    this.checkDate = function (date) {
                        if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.valueOf())) throw new TypeError('Invalide date');
                    };
                    this.map = function (mapper, object) {
                        var target = {};
                        for (var key in object) if (object.hasOwnProperty(key)) target[key] = mapper(object[key], key, object);
                        return target;
                    };
                    this.type = 'druid-datasource';
                    this.url = instanceSettings.url;
                    this.name = instanceSettings.name;
                    this.basicAuth = instanceSettings.basicAuth;
                    instanceSettings.jsonData = instanceSettings.jsonData || {};
                    this.supportAnnotations = true;
                    this.supportMetrics = true;
                    this.q = $q;
                    this.backendSrv = backendSrv;
                    this.templateSrv = templateSrv;
                    this.durationRegex = /^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/;
                }
                DruidDatasource.prototype.replaceTemplateValues = function (obj, attrList) {
                    var self = this;
                    // console.log("objjjj",obj);
                    var substitutedVals = attrList.map(function (attr) {
                        return self.templateSrv.replace(obj[attr]);
                    });
                    if (obj.type == "in") return lodash_1.default.assign(lodash_1.default.clone(obj, true), lodash_1.default.zipObject(attrList, [obj.valuesArr]));
                    //  var vals=JSON.parse(substitutedVals[0]);
                    return lodash_1.default.assign(lodash_1.default.clone(obj, true), lodash_1.default.zipObject(attrList, substitutedVals));
                };
                DruidDatasource.prototype.testDatasource = function () {
                    return this._get('/druid/v2/datasources').then(function () {
                        return { status: "success", message: "Druid Data source is working", title: "Success" };
                    });
                };
                //Get list of available datasources
                DruidDatasource.prototype.getDataSources = function () {
                    return this._get('/druid/v2/datasources').then(function (response) {
                        return response.data;
                    });
                };
                DruidDatasource.prototype.getDimensionsAndMetrics = function (datasource) {
                    return this._get('/druid/v2/datasources/' + datasource + '?interval=0/3000').then(function (response) {
                        console.log("response.data", response.data);
                        return response.data;
                    });
                };
                DruidDatasource.prototype.metricFindQuery = function (query) {
                    // FIXME: datasource should be taken from the Template query options.
                    return this._get('/druid/v2/datasources/BeaconDataSource').then(function (response) {
                        var dimensions = lodash_1.default.map(response.data.dimensions, function (e) {
                            return { "text": e };
                        });
                        dimensions.unshift({ "text": "--" });
                        return dimensions;
                    });
                };
                DruidDatasource.prototype._get = function (relativeUrl, params) {
                    return this.backendSrv.datasourceRequest({
                        method: 'GET',
                        url: this.url + relativeUrl,
                        params: params
                    });
                };
                DruidDatasource.prototype.crossPostAggsCalculator = function (res) {
                    res.forEach(function (x) {
                        if (x.datapoints.length == 0) throw "no datapoint exists in this range. Change the range";
                        if (!lodash_1.default.isEmpty(x.refAgg)) {
                            var tmp_str = x.expression;
                            var y_list = {};
                            var k_list = {};
                            var i = 0;
                            var trgAgg = [];
                            var j = 0;
                            var currAgg = [];
                            x.refAgg.forEach(function (s) {
                                var found = false;
                                res.forEach(function (y, idy) {
                                    if (x.datapoints.length != y.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
                                    if (y.refId == Object.keys(s)[0] && y.target == s[Object.keys(s)[0]]) {
                                        var trg_agg = Object.keys(s)[0] + "." + s[Object.keys(s)[0]];
                                        trgAgg[i] = "trgAgg_" + i;
                                        //tmp_str=tmp_str.replace(new RegExp(trg_agg,"g"),trgAgg[i]);
                                        tmp_str = tmp_str.replace(trg_agg, trgAgg[i]);
                                        y_list[trgAgg[i]] = idy;
                                        i++;
                                        found = true;
                                    }
                                });
                                if (!found) throw Object.keys(s)[0] + "." + s[Object.keys(s)[0]] + " does not exist";
                            });
                            x.refKey.forEach(function (m) {
                                // var found=false;  
                                console.log("mmmm", m);
                                currAgg[j] = "currAgg_" + j;
                                tmp_str = tmp_str.replace(m, currAgg[j]);
                                // console.log("tmp str and curr",tmp_str,currAgg[j]);
                                k_list[currAgg[j]] = 0;
                                j++;
                                /* res.forEach(function (k,idk) {
                                   if (x.datapoints.length!=k.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
                                                     if ( k.refId==x.refId && k.target==m ) {
                                    
                                         currAgg[j]="currAgg_"+j;
                                                           tmp_str=tmp_str.replace(m ,currAgg[j]);
                                         k_list[currAgg[j]]=idk
                                         j++;
                                         found=true;
                                                       }
                                  
                                   });*/
                                //  if (!found) throw "Aggregation "+m+" does not exist";
                            });
                            x.datapoints.forEach(function (z, idz) {
                                // console.log("z[0]",z[0]);
                                for (var prop1 in k_list) {
                                    // this.crossPostAggsCalculator[prop1]=1;
                                    window[prop1] = 1; //res[k_list[prop1]].datapoints[idz][0];
                                }
                                for (var prop2 in y_list) {
                                    //this.crossPostAggsCalculator[prop2]=res[y_list[prop2]].datapoints[idz][0];
                                    window[prop2] = res[y_list[prop2]].datapoints[idz][0];
                                }
                                var corr = eval(tmp_str);
                                z[0] = z[0] * corr;
                            });
                        }
                    });
                };
                ;
                /*private crossPostAggsCalculator(res:any)  {
                
                      res.forEach( function(x) {
                          if (x.datapoints.length==0) throw "no datapoint exists in this range. Change the range";
                          if (!_.isEmpty(x.refAgg)) {
                              var tmp_str=x.expression;
                              var y_list:any={};
                              var k_list:any={};
                              var i=0;
                              var trgAgg=[];
                              var j=0;
                              var currAgg=[];
                    
                              x.refAgg.forEach(function(s){
                                var found=false;
                                res.forEach(function(y,idy){
                                  if (x.datapoints.length!=y.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
                              
                                  if (y.refId==Object.keys(s)[0] && y.target==s[Object.keys(s)[0]] ) {
                                    
                                      
                                      var trg_agg=Object.keys(s)[0]+"."+s[Object.keys(s)[0]];
                                      trgAgg[i]="trgAgg_"+i;
                                      //tmp_str=tmp_str.replace(new RegExp(trg_agg,"g"),trgAgg[i]);
                                      tmp_str=tmp_str.replace(trg_agg,trgAgg[i]);
                                      y_list[trgAgg[i]]=idy;
                                      i++;
                                      found=true;
                                   
                                  }
                                 
                
                                });
                               if (!found) throw Object.keys(s)[0]+"."+s[Object.keys(s)[0]]+" does not exist";
                              });
                             
                              x.refKey.forEach( function (m){
                                var found=false;
                                res.forEach(function (k,idk) {
                                  if (x.datapoints.length!=k.datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
                
                                  if ( k.refId==x.refId && k.target==m ) {
                                   
                                        currAgg[j]="currAgg_"+j;
                
                                        tmp_str=tmp_str.replace(m ,currAgg[j]);
                                        k_list[currAgg[j]]=idk
                                        j++;
                                        found=true;
                
                                    }
                                 
                                  });
                                 if (!found) throw "Aggregation "+m+" does not exist";
                              }) ;
                           
                              x.datapoints.forEach(function (z,idz){
                               
                                 for (var prop1 in k_list) {
                                  window[prop1]=res[k_list[prop1]].datapoints[idz][0];
                
                                 }
                                 for (var prop2 in y_list) {
                                  window[prop2]=res[y_list[prop2]].datapoints[idz][0];
                
                                 }
                                  
                                var corr = eval(tmp_str);
                                  
                                z[0]=corr;
                
                              });
                
                
                          }
                      });
                
                  };
                
                */
                /*
                private crossPostAggsCalculator(res:any)  {
                
                      var l1=res.length;
                      while (l1--) {
                        if (res[l1].datapoints.length==0) throw "no datapoint exists in this range. Change the range";
                        if (!_.isEmpty(res[l1].refAgg)) {
                          var tmp_str=res[l1].expression;
                          var y_list:any={};
                          var k_list:any={};
                          var i=0;
                          var trgAgg=[];
                          var j=0;
                          var currAgg=[];
                
                          var l2=res[l1].refAgg.length;
                
                          while(l2--){
                            var found=false;
                            var tmp_refId=Object.keys(res[l1].refAgg[l2])[0], tmp_targ=res[l1].refAgg[l2][Object.keys(res[l1].refAgg[l2])[0]];
                             
                            var l3=res.length;
                            while(l3--){
                              if (res[l1].datapoints.length!=res[l3].datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
                              if (res[l3].refId==tmp_refId  && res[l3].target==tmp_targ ){
                                var trg_agg=tmp_refId+"."+tmp_targ;
                                trgAgg[i]="trgAgg_"+i;
                                tmp_str=tmp_str.replace(trg_agg,trgAgg[i]);
                                y_list[trgAgg[i]]=l3;
                                i++;
                                found=true;
                
                              }
                
                            }
                            if (!found) throw tmp_refId+"."+tmp_targ+" does not exist";
                
                          }
                
                          l2=res[l1].refKey.length;
                          while (l2--){
                            var found=false;
                            var l3=res.length;
                            while(l3--){
                              if (res[l1].datapoints.length!=res[l3].datapoints.length) throw "datasources don't have the same number of datapoints or the same granularity";
                              if (res[l1].refId==res[l3].refId  && res[l3].target==res[l1].refKey[l2]) {
                
                                currAgg[j]="currAgg_"+j;
                                tmp_str=tmp_str.replace(res[l1].refKey[l2] ,currAgg[j]);
                                k_list[currAgg[j]]=l3;
                                j++;
                                found=true;
                
                              }
                
                            }
                
                            if (!found) throw "Aggregation "+res[l1].refKey[l2]+" does not exist";
                
                          }
                          
                          l2=res[l1].datapoints.length;
                          while(l2--){
                            for (var prop1 in k_list) {
                              window[prop1]=res[k_list[prop1]].datapoints[l2][0];
                
                            }
                            for (var prop2 in y_list) {
                              window[prop2]=res[y_list[prop2]].datapoints[l2][0];
                
                            }
                                  
                            var corr = eval(tmp_str);
                              
                            res[l1].datapoints[l2][0]=corr;
                
                
                
                          }
                          
                
                        }
                
                
                
                      }
                
                     
                
                  }*/
                DruidDatasource.prototype.handleTopNJoinData = function (res) {
                    var parsedExp = null,
                        keys = [];
                    ;
                    if (res[0].topNJoinData.expression) {
                        parsedExp = jsep_1.default(res[0].topNJoinData.expression);
                        this._parseObjectKeys(parsedExp, "name", keys);
                    }
                    var foundVals = keys.reduce(function (a, b) {
                        if (!lodash_1.default.find(a, function (y) {
                            return y == b;
                        }) && (b.slice(-1) == 1 || b.slice(-1) == 2)) {
                            a.push(b);
                        }
                        return a;
                    }, []).sort(function (a, b) {
                        return a.slice(-1) > b.slice(-1);
                    });
                    if (foundVals.length != 2) throw "there arent two variables or as labeled in placeholder";
                    if (foundVals[0].slice(0, -1) != res[0].topNJoinData.metric || foundVals[1].slice(0, -1) != res[0].topNJoinData.metric) throw "  Variables are not labeled as defined in placeholder ";
                    // console.log("foundVals",foundVals,druidmetric,foundVals[0].slice(0,-1), foundVals[1].slice(0,-1) );
                    //console.log("topNJoinExpression",topNJoinExpression);
                    var period_list = lodash_1.default.reduce(res, function (pval, cval) {
                        var tmp = Object.keys(cval.topNJoinData.period)[0];
                        //   var tmp=Object.keys(cval.datapoints[0][2])[0];
                        if (tmp && !lodash_1.default.find(pval, function (x) {
                            return tmp == x;
                        })) {
                            pval.push(tmp);
                        }
                        return pval;
                    }, []).sort(function (a, b) {
                        return moment_1.default.duration(a).valueOf() > moment_1.default.duration(b).valueOf();
                    });
                    //  console.log("period_list",period_list);
                    var filteron0SubResData = [],
                        filteron1SubResData = [];
                    if (period_list.length == 2 && lodash_1.default.find(period_list, function (x) {
                        return x == "all";
                    })) {
                        filteron0SubResData = lodash_1.default.filter(res, function (x) {
                            return Object.keys(x.topNJoinData.period)[0] == period_list[1];
                        });
                        filteron1SubResData = lodash_1.default.filter(res, function (x) {
                            return Object.keys(x.topNJoinData.period)[0] == "all";
                        });
                    } else if (period_list.length == 1) {
                        filteron0SubResData = lodash_1.default.filter(res, function (x) {
                            return x.topNJoinData.period[Object.keys(x.topNJoinData.period)[0]] == 0;
                        });
                        filteron1SubResData = lodash_1.default.filter(res, function (x) {
                            return x.topNJoinData.period[Object.keys(x.topNJoinData.period)[0]] == 1;
                        });
                    } else {
                        filteron0SubResData = lodash_1.default.filter(res, function (x) {
                            return Object.keys(x.topNJoinData.period)[0] == period_list[0];
                        });
                        filteron1SubResData = lodash_1.default.filter(res, function (x) {
                            return Object.keys(x.topNJoinData.period)[0] == period_list[1];
                        });
                    }
                    // console.log("filteron0SubResData",filteron0SubResData);
                    //  console.log("filteron1SubResData",filteron1SubResData);
                    var finalResData = [];
                    filteron0SubResData.forEach(function (x) {
                        filteron1SubResData.forEach(function (y) {
                            if (x.target == y.target) {
                                var tmp = {};
                                tmp.target = x.target;
                                tmp.timeShift = x.timeShift;
                                tmp.datapoints = new Array();
                                var yPeriod = null,
                                    criValue = 0;
                                if (Object.keys(y.topNJoinData.period)[0] == "all") {
                                    yPeriod = Infinity;
                                    criValue = -Infinity;
                                } else yPeriod = moment_1.default.duration(Object.keys(y.topNJoinData.period)[0]).valueOf();
                                x.datapoints.forEach(function (z) {
                                    y.datapoints.forEach(function (k) {
                                        //    console.log("z1,k1",moment(z[1]).format(),moment(k[1]).format());
                                        //  console.log("z1 ve k1 ",z[1],k[1]); 
                                        if (moment_1.default(z[1]).diff(k[1]) >= criValue && moment_1.default(z[1]).diff(k[1]) < yPeriod) {
                                            var sub_tmp = null;
                                            window[foundVals[0]] = z[0];
                                            window[foundVals[1]] = k[0];
                                            if (window[foundVals[1]] == null) sub_tmp = [null, z[1]];else {
                                                if (window[foundVals[0]] == null) sub_tmp = [null, z[1]];else {
                                                    window[foundVals[0]] = z[0];
                                                    window[foundVals[1]] = k[0];
                                                    // console.log(" window[foundVals[0]]", window[foundVals[0]]);
                                                    var calc = eval(res[0].topNJoinData.expression);
                                                    //sub_tmp=[100*z[0]/k[0], z[1]]
                                                    sub_tmp = [calc, z[1]];
                                                }
                                            }
                                            ;
                                            tmp.datapoints.push(sub_tmp);
                                        }
                                    });
                                });
                                finalResData.push(tmp);
                            }
                        });
                    });
                    return finalResData;
                };
                // Called once per panel (graph)
                DruidDatasource.prototype.query = function (options) {
                    var dataSource = this;
                    console.log("Do query");
                    console.log(options);
                    var refId_MetricNames = [];
                    // var topNJoinLimit=null;
                    // var topNJoinExpression=null;
                    //  var druidmetric=null;
                    var promises = [];
                    for (var j = 0; j < options.targets.length; j++) {
                        if (lodash_1.default.isEmpty(options.targets[j].druidDS) || lodash_1.default.isEmpty(options.targets[j].aggregators) && lodash_1.default.isEmpty(options.targets[j].aggregators1) && options.targets[j].queryType !== "select") {
                            console.log("options.targets[j].druidDS: " + options.targets[j].druidDS + ", options.targets[j].aggregators: " + options.targets[j].aggregators + options.targets[j].aggregators1);
                            var d = dataSource.q.defer();
                            d.resolve([]);
                            return d.promise;
                        }
                        var aggregators = dataSource._merge(options.targets[j].aggregators, options.targets[j].aggregators1);
                        var postAggregators = dataSource._merge(options.targets[j].postAggregators, options.targets[j].postAggregators1);
                        refId_MetricNames.push(lodash_1.default.map(DruidDatasource.getMetricNames(aggregators, postAggregators), function (x) {
                            var tmp = {};
                            tmp[options.targets[j].refId] = x;
                            return tmp;
                        }));
                        var maxDataPointsByResolution = options.maxDataPoints;
                        var maxDataPointsByConfig = options.targets[j].maxDataPoints ? options.targets[j].maxDataPoints : Number.MAX_VALUE;
                        var maxDataPoints = Math.min(maxDataPointsByResolution, maxDataPointsByConfig);
                        console.log("maxDataPoints", maxDataPoints);
                        var granularity = null;
                        var granularity1 = null;
                        if (options.targets[j].queryType == "topNJoin") {
                            // topNJoinExpression=options.targets[j].topNJoinExpression;
                            //  druidmetric=options.targets[j].druidMetric;
                            var date_from = options.range.from.clone();
                            var date_to = options.range.to.clone();
                            dataSource._timeShiftFromTo(options.targets[j], "back", date_from, date_to);
                            var from = DruidDatasource.dateToMoment(date_from, false);
                            var to = DruidDatasource.dateToMoment(date_to, true);
                            //  console.log("from",from);
                            //   topNJoinLimit=options.targets[j].limit;
                            if (options.targets[j].shouldOverrideGranularity) granularity = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (entry) {
                                return entry[0] === options.targets[j].customGranularity;
                            });else granularity = dataSource.computeGranularity(from, to, maxDataPoints);
                            if (options.targets[j].shouldOverrideGranularity) granularity1 = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (entry) {
                                return entry[0] === options.targets[j].customGranularity1;
                            });else granularity1 = dataSource.computeGranularity(from, to, maxDataPoints);
                            var roundedFrom = granularity[0] === "all" ? from : dataSource.roundDownStartTime(from, granularity[0]);
                            var roundedFrom1 = granularity1[0] === "all" ? from : dataSource.roundDownStartTime(from, granularity1[0]);
                            if (options.targets[j].filters1.length > 0 && options.targets[j].filters.length > 0 || options.targets[j].filters1.length == 0 && options.targets[j].filters.length > 0) {
                                console.log("granularityies", granularity[2], granularity1[2]);
                                promises.push(dataSource._doQuery(roundedFrom, to, granularity[2], options.targets[j]));
                                promises.push(dataSource._doQuery(roundedFrom1, to, granularity1[2], options.targets[j], true));
                            } else throw "Please fill the first filter section at least!..";
                        } else {
                            var date_from = options.range.from.clone();
                            var date_to = options.range.to.clone();
                            dataSource._timeShiftFromTo(options.targets[j], "back", date_from, date_to);
                            var from = DruidDatasource.dateToMoment(date_from, false);
                            var to = DruidDatasource.dateToMoment(date_to, true);
                            console.log("from", from);
                            if (options.targets[j].shouldOverrideGranularity) granularity = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (entry) {
                                return entry[0] === options.targets[j].customGranularity;
                            });else granularity = dataSource.computeGranularity(from, to, maxDataPoints);
                            //Round up to start of an interval
                            //Width of bar chars in Grafana is determined by size of the smallest interval
                            var roundedFrom = granularity[0] === "all" ? from : dataSource.roundDownStartTime(from, granularity[0]);
                            promises.push(dataSource._doQuery(roundedFrom, to, granularity[2], options.targets[j]));
                        }
                    }
                    /* var promises = options.targets.map(function (target) {
                     var date_from = options.range.from.clone();
                     var date_to = options.range.to.clone();
                     //console.log("target.timeShift",target.timeShift);
                     //console.log("target.prePostAgg",target.currentPrePostAgg);
                       
                     dataSource._timeShiftFromTo(target,"back", date_from,date_to);
                               
                     var from = DruidDatasource.dateToMoment(date_from, false);
                     var to = DruidDatasource.dateToMoment(date_to, true);
                               
                     if (_.isEmpty(target.druidDS) || ( (_.isEmpty(target.aggregators) &&  _.isEmpty(target.aggregators1) ) && target.queryType !== "select") )  {
                             console.log("target.druidDS: " + target.druidDS + ", target.aggregators: " + target.aggregators+target.aggregators1);
                             var d = dataSource.q.defer();
                             d.resolve([]);
                             return d.promise;
                     }
                                      var aggregators= dataSource._merge(target.aggregators,target.aggregators1);
                      var postAggregators = dataSource._merge(target.postAggregators,target.postAggregators1);
                      
                      refId_MetricNames.push(
                       _.map(DruidDatasource.getMetricNames(aggregators, postAggregators), function(x) {
                                      
                        var tmp:any={};
                        tmp[target.refId]=x;
                        return tmp;
                             
                                       })
                                     );
                               
                                        // console.log("target.postAggregatorsss",target.postAggregators,target.postAggregators1);
                                     var maxDataPointsByResolution = options.maxDataPoints;
                     var maxDataPointsByConfig = target.maxDataPoints ? target.maxDataPoints : Number.MAX_VALUE;
                     var maxDataPoints = Math.min(maxDataPointsByResolution, maxDataPointsByConfig);
                     var granularity = null;
                     if (target.shouldOverrideGranularity)
                       granularity = _.find(DruidDatasource.GRANULARITIES, (entry) => { return entry[0] === target.customGranularity});
                     else
                       granularity = dataSource.computeGranularity(from, to, maxDataPoints);
                                     //Round up to start of an interval
                     //Width of bar chars in Grafana is determined by size of the smallest interval
                     var roundedFrom = granularity[0] === "all" ? from : dataSource.roundUpStartTime(from, granularity[0]);
                                     return dataSource._doQuery(roundedFrom, to, granularity[2], target);
                    
                     });
                    */
                    return dataSource.q.all(promises).then(function (results) {
                        var res = lodash_1.default.flatten(results);
                        // console.log("resultData",res);
                        var resTopNJoin = lodash_1.default.filter(res, function (x) {
                            return x.topNJoinData;
                        });
                        var resNonTopNJoin = lodash_1.default.filter(res, function (x) {
                            return !x.topNJoinData;
                        });
                        res.splice(0);
                        if (resTopNJoin.length > 0) {
                            resTopNJoin = dataSource.handleTopNJoinData(resTopNJoin);
                            dataSource._applyTimeShiftToData(resTopNJoin);
                        }
                        if (resNonTopNJoin.length > 0) {
                            //   console.log("resNonTopNJoin",resNonTopNJoin);
                            dataSource.crossPostAggsCalculator(resNonTopNJoin);
                            var resNonTopNJoin = lodash_1.default.filter(resNonTopNJoin, function (x) {
                                if (typeof x.refId == "undefined") return true;
                                for (var i = 0; i < lodash_1.default.flatten(refId_MetricNames).length; i++) {
                                    var tmp = {};
                                    tmp[x.refId] = x.target;
                                    if (lodash_1.default.isEqual(lodash_1.default.flatten(refId_MetricNames)[i], tmp)) return true;
                                }
                                return false;
                            });
                            dataSource._applyTimeShiftToData(resNonTopNJoin);
                        }
                        return { data: resNonTopNJoin.concat(resTopNJoin) };
                    });
                };
                DruidDatasource.prototype._doQuery = function (from, to, granularity, target, secondFilter) {
                    var _this = this;
                    var filterIndex = null;
                    if (typeof secondFilter == "undefined") {
                        secondFilter = false;
                        filterIndex = 0;
                    } else filterIndex = 1;
                    console.log("granularity.period", granularity.period);
                    var period = {};
                    if (granularity.period) period[granularity.period] = filterIndex;else period["all"] = filterIndex;
                    console.log("period", period);
                    console.log("target.filteron", target.filterOn);
                    var self = this;
                    var datasource = target.druidDS;
                    var filters = secondFilter ? target.filters1 : target.filters;
                    console.log("filters", target.filters, target.filters1);
                    //target.postAggregators=target.postAggregators||[];
                    var aggregators = this._merge(target.aggregators, target.aggregators1);
                    var postAggregators = this._merge(target.postAggregators, target.postAggregators1);
                    for (var i = 0; i < postAggregators.length; i++) {
                        var parse_tree;
                        parse_tree = jsep_1.default(postAggregators[i].expression);
                        var keys = [],
                            refid = [];
                        this._parseObjectKeys(parse_tree, "name", keys, refid);
                        postAggregators[i]["refId"] = refid;
                        postAggregators[i]["refKey"] = keys;
                    }
                    ;
                    //console.log("lookups",target.lookups);
                    var groupBy = target.groupBy;
                    console.log("original groupBy: " + JSON.stringify(groupBy));
                    var interpolatedGroupBy = lodash_1.default.map(groupBy, function (e) {
                        return _this.templateSrv.replace(String(e).replace(/^\s+|\s+$/g, ''), null, 'regex');
                    }).filter(function (e) {
                        return e != "--";
                    });
                    console.log("interpolated groupBy: " + JSON.stringify(interpolatedGroupBy));
                    groupBy = interpolatedGroupBy;
                    var limitSpec = null;
                    var metricNames = DruidDatasource.getMetricNames(aggregators, postAggregators);
                    var allMetricNames = DruidDatasource.getAllMetricNames(aggregators, postAggregators);
                    var intervals = DruidDatasource.getQueryIntervals(from, to);
                    var promise = null;
                    var selectMetrics = target.selectMetrics;
                    var selectDimensions = target.selectDimensions;
                    var selectThreshold = target.selectThreshold;
                    if (!selectThreshold) {
                        selectThreshold = 5;
                    }
                    if (target.queryType === 'SQL') {
                        console.log(target);
                    } else if (target.queryType === 'topN') {
                        var threshold = target.limit;
                        var metric = target.druidMetric;
                        var dimension = target.dimension;
                        var lookups = [];
                        if (target.lookups) lookups = target.lookups;
                        /*if (target.lookups) {
                          var tmpDim;
                          if (tmpDim=_.find(target.lookups,function(x){
                          return  x.dimension==target.dimension;
                                             })) dimension=tmpDim;
                                           }
                        console.log("dimension",dimension);*/
                        promise = this._topNQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension, lookups).then(function (response) {
                            return self.convertTopNData(response.data, dimension, metric, target);
                        });
                    } else if (target.queryType === 'topNJoin') {
                        var threshold = target.limit;
                        if (secondFilter) threshold = 99999;
                        var metric = target.druidMetric;
                        var dimension = target.dimension;
                        var lookups = [];
                        if (target.lookups) lookups = target.lookups;
                        /*if (target.lookups) {
                          var tmpDim;
                          if (tmpDim=_.find(target.lookups,function(x){
                          return  x.dimension==target.dimension;
                                             })) dimension=tmpDim;
                                           }
                        console.log("dimension",dimension);*/
                        promise = this._topNJoinQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension, lookups).then(function (response) {
                            return self.convertTopNData(response.data, dimension, metric, target, period);
                        });
                    } else if (target.queryType === 'groupBy') {
                        var lookups = [];
                        if (target.lookups) lookups = target.lookups;
                        limitSpec = DruidDatasource.getLimitSpec(target.limit, target.orderBy);
                        promise = this._groupByQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec, lookups).then(function (response) {
                            return self.convertGroupByData(response.data, groupBy, metricNames);
                        });
                    } else if (target.queryType === 'select') {
                        promise = this._selectQuery(datasource, intervals, granularity, selectDimensions, selectMetrics, filters, selectThreshold);
                        return promise.then(function (response) {
                            return self.convertSelectData(response.data);
                        });
                    } else {
                        var lookups = [];
                        if (target.lookups) lookups = target.lookups;
                        promise = this._timeSeriesQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, lookups).then(function (response) {
                            return DruidDatasource.convertTimeSeriesData(response.data, allMetricNames, target);
                        });
                    }
                    /*
                     At this point the promise will return an list of time series of this form
                     [
                     {
                     target: <metric name>,
                     datapoints: [
                     [<metric value>, <timestamp in ms>],
                     ...
                     ]
                     },
                     ...
                     ]
                                      Druid calculates metrics based on the intervals specified in the query but returns a timestamp rounded down.
                     We need to adjust the first timestamp in each time series
                     */
                    return promise.then(function (metrics) {
                        var fromMs = DruidDatasource.formatTimestamp(from);
                        metrics.forEach(function (metric) {
                            if (!lodash_1.default.isEmpty(metric.datapoints[0]) && metric.datapoints[0][1] < fromMs) {
                                metric.datapoints[0][1] = fromMs;
                            }
                        });
                        return metrics;
                    });
                };
                DruidDatasource.prototype._selectQuery = function (datasource, intervals, granularity, dimension, metric, filters, selectThreshold) {
                    var query = {
                        "queryType": "select",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "pagingSpec": { "pagingIdentifiers": {}, "threshold": selectThreshold },
                        "dimensions": dimension,
                        "metrics": metric,
                        "intervals": intervals
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f) query["filter"] = f;
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._timeSeriesQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, lookups) {
                    var self = this;
                    var query = {
                        "queryType": "timeseries",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) {
                            return e.druidQuery;
                        }),
                        "intervals": intervals
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f) query["filter"] = f;
                        // console.log("filterafter",_.cloneDeep( f));
                        //var new_f=_.cloneDeep(f);   
                        var filterDimList = this.findObjetVal(filters, "dimension");
                        filterDimList.forEach(function (y) {
                            var tmpDim;
                            if (tmpDim = lodash_1.default.find(lookups, function (x) {
                                return x.dimension == y;
                            })) {
                                self.delAndMergeObject(f, "dimension", y, tmpDim);
                            }
                        });
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._topNQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension, lookups) {
                    var self = this;
                    console.log("lookups", lookups);
                    var dim = { "dimension": dimension };
                    var tmpDim;
                    if (tmpDim = lodash_1.default.find(lookups, function (x) {
                        return x.dimension == dimension;
                    })) {
                        dim = tmpDim;
                    }
                    var query = {
                        "queryType": "topN",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "threshold": threshold,
                        "dimension": dim,
                        "metric": metric,
                        // "metric": {type: "inverted", metric: metric},
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) {
                            return e.druidQuery;
                        }),
                        "intervals": intervals
                    };
                    // _.defaults(query,dim);
                    //  console.log("query",query);
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f) query["filter"] = f;
                        var filterDimList = this.findObjetVal(filters, "dimension");
                        //console.log("filterDimList",filterDimList);
                        filterDimList.forEach(function (y) {
                            var tmpDim;
                            if (tmpDim = lodash_1.default.find(lookups, function (x) {
                                return x.dimension == y;
                            })) {
                                self.delAndMergeObject(f, "dimension", y, tmpDim);
                            }
                        });
                    }
                    console.log("this._druidQuery", this._druidQuery(query));
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._topNJoinQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension, lookups) {
                    var self = this;
                    console.log("lookups", lookups);
                    var dim = { "dimension": dimension };
                    console.log("granularity in query", granularity);
                    var tmpDim;
                    if (tmpDim = lodash_1.default.find(lookups, function (x) {
                        return x.dimension == dimension;
                    })) {
                        dim = tmpDim;
                    }
                    var query = {
                        "queryType": "topN",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "threshold": threshold,
                        "dimension": dim,
                        "metric": metric,
                        // "metric": {type: "inverted", metric: metric},
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) {
                            return e.druidQuery;
                        }),
                        "intervals": intervals
                    };
                    // _.defaults(query,dim);
                    //  console.log("query",query);
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f) query["filter"] = f;
                        var filterDimList = this.findObjetVal(filters, "dimension");
                        //console.log("filterDimList",filterDimList);
                        filterDimList.forEach(function (y) {
                            var tmpDim;
                            if (tmpDim = lodash_1.default.find(lookups, function (x) {
                                return x.dimension == y;
                            })) {
                                self.delAndMergeObject(f, "dimension", y, tmpDim);
                            }
                        });
                    }
                    console.log("this._druidQuery", this._druidQuery(query));
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._groupByQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec, lookups) {
                    var self = this;
                    var dims = [];
                    groupBy.forEach(function (y) {
                        var tmpDim;
                        if (tmpDim = lodash_1.default.find(lookups, function (x) {
                            return x.dimension == y;
                        })) {
                            dims.push(tmpDim);
                        }
                    });
                    if (dims.length == 0) dims = groupBy;
                    var query = {
                        "queryType": "groupBy",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "dimensions": dims,
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) {
                            return e.druidQuery;
                        }),
                        "intervals": intervals,
                        "limitSpec": limitSpec
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f) query["filter"] = f;
                        var filterDimList = this.findObjetVal(filters, "dimension");
                        filterDimList.forEach(function (y) {
                            var tmpDim;
                            if (tmpDim = lodash_1.default.find(lookups, function (x) {
                                return x.dimension == y;
                            })) {
                                self.delAndMergeObject(f, "dimension", y, tmpDim);
                            }
                        });
                    }
                    //console.log(" this._druidQuery(query)", this._druidQuery(query));
                    return this._druidQuery(query);
                };
                ;
                DruidDatasource.prototype._sqlQuery = function (datasource, columns, where, group_by, having, order_by, limit, offset) {
                    var query = {
                        "queryType": "sql"
                    };
                    var sql = "SELECT " + DruidDatasource.buildColumns(columns) + " FROM " + datasource;
                    if (where) {
                        sql = sql + " WHERE " + where;
                    }
                    if (group_by) {
                        sql = sql + " GROUP BY " + group_by;
                    }
                    if (having) {
                        sql = sql + " HAVING " + having;
                    }
                    if (order_by) {
                        sql = sql + " ORDER BY " + order_by;
                    }
                    if (limit) {
                        sql = sql + " LIMIT " + limit;
                        if (offset) {
                            sql = sql + " OFFSET " + offset;
                        }
                    }
                    query['sql'] = sql;
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype.findObjetVal = function (obj, prop) {
                    var found_list = [];
                    if (obj instanceof Object) {
                        for (var p in obj) {
                            if (p == prop) found_list.push(obj[p]);else found_list = found_list.concat(this.findObjetVal(obj[p], prop));
                        }
                    }
                    return found_list;
                };
                DruidDatasource.prototype.replaceObjectVal = function (obj, prop, source_val, targ_val) {
                    for (var p in obj) {
                        if (obj.hasOwnProperty(p)) {
                            if (p === prop && obj[p] == source_val) {
                                obj[p] = targ_val;
                                return null;
                            } else if (obj[p] instanceof Object) return this.replaceObjectVal(obj[p], prop, source_val, targ_val);
                        }
                    }
                };
                DruidDatasource.prototype.delAndMergeObject = function (obj, prop, source_val, targ_val) {
                    for (var p in obj) {
                        if (obj.hasOwnProperty(p)) {
                            if (p === prop && obj[p] == source_val) {
                                lodash_1.default.defaults(obj, targ_val);
                                return;
                            } else if (obj[p] instanceof Object) this.delAndMergeObject(obj[p], prop, source_val, targ_val);
                        }
                    }
                };
                DruidDatasource.prototype._merge = function (componet1, componet2) {
                    componet1 = componet1 || [];
                    componet2 = componet2 || [];
                    // if (typeof componet1 =="undefined") componet1=[];
                    // if (typeof componet2 =="undefined") componet2=[];
                    /* componet1= (typeof  componet1!= "undefined" ) ?  componet1:[];
                     componet2= (typeof  componet2!= "undefined" ) ?  componet2 :[];
                       */
                    return componet1.concat(componet2);
                };
                DruidDatasource.prototype._parseObjectKeys = function (obj, name, keys, refid) {
                    for (var prop in obj) {
                        if (prop == "object") {
                            var tmp = {};
                            tmp[obj.object.name] = obj.property.name;
                            refid.push(tmp);
                        } else if (prop == "property") continue;else {
                            var sub = obj[prop];
                            // console.log("prop[name]",prop);
                            if (prop == name) {
                                keys.push(obj[name]);
                            }
                        }
                        if (typeof sub == "object") {
                            this._parseObjectKeys(sub, name, keys, refid);
                        }
                    }
                };
                DruidDatasource.prototype._parseTimeShift = function (target) {
                    if (target.timeShift) {
                        //var myRegexp = /^(\+\d+|-\d+|\d+)(d|h){1}$/g;
                        var myRegexp = /^(\d+|\+\d+)(d|h){1}$/g;
                        var match = myRegexp.exec(target.timeShift);
                        if (match) return match;else return null;
                    } else return null;
                };
                DruidDatasource.prototype._timeShiftFromTo = function (target, backOrforth, from, to) {
                    if (target.timeShift) {
                        var match = this._parseTimeShift(target);
                        var direction = null;
                        if (backOrforth == "back") direction = -1;else if (backOrforth == "forth") direction = 1;else return;
                        if (!match) {
                            target.timeShift = undefined;
                            return;
                        }
                        if (match[2] == "d") {
                            from.add(direction * Number(match[1]), "days");
                            if (typeof to !== 'undefined') to.add(direction * Number(match[1]), "days");
                        } else if (match[2] == "h") {
                            from.add(direction * Number(match[1]), "hours");
                            if (typeof to !== 'undefined') to.add(direction * Number(match[1]), "hours");
                        }
                    }
                };
                DruidDatasource.prototype._applyTimeShiftToData = function (res) {
                    var self = this;
                    res.forEach(function (x, idx) {
                        if (x.timeShift) {
                            var str = "&#9716;";
                            str = jquery_1.default("<div/>").html(str).text();
                            // x.target=x.target+'<span style="color:#4d79ff">'+" ("+str+"-"+x.timeShift+")" +"</span>";
                            x.target = x.target + " (" + str + "-" + x.timeShift + ")";
                        }
                        x.datapoints.forEach(function (y) {
                            var date = DruidDatasource.dateToMoment(new Date(y[1]), false);
                            self._timeShiftFromTo(x, "forth", date);
                            if (x.timeShift) y[1] = date.valueOf();
                        });
                    });
                };
                DruidDatasource.buildColumns = function (columns) {
                    return columns.join(", ");
                };
                DruidDatasource.prototype._druidQuery = function (query) {
                    var options = {
                        method: 'POST',
                        url: this.url + '/druid/v2/?pretty',
                        data: query
                    };
                    console.log("Make http request");
                    console.log(JSON.stringify(options));
                    //   console.log("this.backendSrv.datasourceRequest(options)",this.backendSrv.datasourceRequest(options));
                    return this.backendSrv.datasourceRequest(options);
                };
                ;
                DruidDatasource.getLimitSpec = function (limitNum, orderBy) {
                    return {
                        "type": "default",
                        "limit": limitNum,
                        "columns": !orderBy ? null : orderBy.map(function (col) {
                            return { "dimension": col, "direction": "DESCENDING" };
                        })
                    };
                };
                DruidDatasource.prototype.buildFilterTree = function (filters) {
                    //Do template variable replacement
                    var self = this;
                    var replacedFilters = filters.map(function (filter) {
                        // TODO: fix the function map lookup
                        // return this.filterTemplateExpanders[filter.type](filter);
                        if (filter.type == "selector") return self.replaceTemplateValues(filter, ['value']);else if (filter.type == "regex") return self.replaceTemplateValues(filter, ['pattern']);else if (filter.type == "javascript") return self.replaceTemplateValues(filter, ['function']);else if (filter.type == "in") return self.replaceTemplateValues(filter, ['values']);
                    }).map(function (filter) {
                        var finalFilter = lodash_1.default.omit(filter, 'negate');
                        if (filter && "negate" in filter && filter.negate) {
                            return { "type": "not", "field": finalFilter };
                        }
                        return finalFilter;
                    });
                    if (replacedFilters) {
                        if (replacedFilters.length === 1) {
                            return replacedFilters[0];
                        }
                        return {
                            "type": "and",
                            "fields": replacedFilters
                        };
                    }
                    return null;
                };
                DruidDatasource.getQueryIntervals = function (from, to) {
                    return [from.toISOString() + '/' + to.toISOString()];
                };
                DruidDatasource.getMetricNames = function (aggregators, postAggregators) {
                    var displayAggs = lodash_1.default.filter(aggregators, function (agg) {
                        return agg.display && agg.type !== 'approxHistogramFold';
                    });
                    return lodash_1.default.union(lodash_1.default.map(displayAggs, 'name'), lodash_1.default.map(postAggregators, 'name'));
                };
                DruidDatasource.getAllMetricNames = function (aggregators, postAggregators) {
                    var displayAggs = lodash_1.default.filter(aggregators, function (agg) {
                        return agg.type !== 'approxHistogramFold';
                    });
                    return lodash_1.default.union(lodash_1.default.map(displayAggs, 'name'), lodash_1.default.map(postAggregators, 'name'));
                };
                ;
                DruidDatasource.formatTimestamp = function (ts) {
                    return moment_1.default(ts).format('X') * 1000;
                };
                DruidDatasource.convertTimeSeriesData = function (md, metrics, trg) {
                    return metrics.map(function (metric) {
                        var postagg = {};
                        var ref_agg,
                            exp,
                            refkey = [];
                        trg.postAggregators = trg.postAggregators || [];
                        trg.postAggregators1 = trg.postAggregators1 || [];
                        var combined_postaggs = trg.postAggregators.concat(trg.postAggregators1);
                        if (postagg = lodash_1.default.find(combined_postaggs, function (x) {
                            return x.name == metric;
                        })) {
                            ref_agg = postagg.refId;
                            exp = postagg.expression;
                            if (postagg.refKey) refkey = postagg.refKey; //if (postagg.refKey.length==1) refkey=postagg.refKey[0];
                        }
                        return {
                            target: metric,
                            timeShift: trg.timeShift,
                            refId: trg.refId,
                            refAgg: ref_agg,
                            refKey: refkey,
                            expression: exp,
                            datapoints: md.map(function (item) {
                                return [item.result[metric], DruidDatasource.formatTimestamp(item.timestamp)];
                            })
                        };
                    });
                };
                ;
                DruidDatasource.getGroupName = function (groupBy, metric) {
                    return groupBy.map(function (dim) {
                        return metric.event[dim];
                    }).join("-");
                };
                DruidDatasource.prototype.convertTopNData = function (md, dimension, metric, trg, period) {
                    // if (typeof period =="undefined") ;
                    //  console.log("mdfirst ",md);
                    /*
                     Druid topN results look like this:
                     [
                     {
                     "timestamp": "ts1",
                     "result": [
                     {"<dim>": d1, "<metric>": mv1},
                     {"<dim>": d2, "<metric>": mv2}
                     ]
                     },
                     {
                     "timestamp": "ts2",
                     "result": [
                     {"<dim>": d1, "<metric>": mv3},
                     {"<dim>": d2, "<metric>": mv4}
                     ]
                     },
                     ...
                     ]
                     */
                    /*
                     First, we need make sure that the result for each
                     timestamp contains entries for all distinct dimension values
                     in the entire list of results.
                                      Otherwise, if we do a stacked bar chart, Grafana doesn't sum
                     the metrics correctly.
                     */
                    //Get the list of all distinct dimension values for the entire result set
                    //Get the list of all distinct dimension values for the entire result set
                    var dVals = md.reduce(function (dValsSoFar, tsItem) {
                        var dValsForTs = lodash_1.default.map(tsItem.result, dimension);
                        return lodash_1.default.union(dValsSoFar, dValsForTs);
                    }, {});
                    //console.log("Dvals",dVals);
                    //Add null for the metric for any missing dimension values per timestamp result
                    md.forEach(function (tsItem) {
                        var dValsPresent = lodash_1.default.map(tsItem.result, dimension);
                        var dValsMissing = lodash_1.default.difference(dVals, dValsPresent);
                        dValsMissing.forEach(function (dVal) {
                            var nullPoint = {};
                            nullPoint[dimension] = dVal;
                            nullPoint[metric] = null;
                            tsItem.result.push(nullPoint);
                        });
                        return tsItem;
                    });
                    //Re-index the results by dimension value instead of time interval
                    //console.log("mddd",md);
                    var mergedData = md.map(function (item) {
                        /*
                         This first map() transforms this into a list of objects
                         where the keys are dimension values
                         and the values are [metricValue, unixTime] so that we get this:
                         [
                         {
                         "d1": [mv1, ts1],
                         "d2": [mv2, ts1]
                         },
                         {
                         "d1": [mv3, ts2],
                         "d2": [mv4, ts2]
                         },
                         ...
                         ]
                         */
                        var timestamp = DruidDatasource.formatTimestamp(item.timestamp);
                        var keys = lodash_1.default.map(item.result, dimension);
                        var vals = lodash_1.default.map(item.result, metric).map(function (val) {
                            if (period) return [val, timestamp];
                            return [val, timestamp];
                        });
                        // console.log("_.zipObject(keys, vals)",_.zipObject(keys, vals));
                        return lodash_1.default.zipObject(keys, vals);
                    }).reduce(function (prev, curr) {
                        /*
                         Reduce() collapses all of the mapped objects into a single
                         object.  The keys are dimension values
                         and the values are arrays of all the values for the same key.
                         The _.assign() function merges objects together and it's callback
                         gets invoked for every key,value pair in the source (2nd argument).
                         Since our initial value for reduce() is an empty object,
                         the _.assign() callback will get called for every new val
                         that we add to the final object.
                         */
                        return lodash_1.default.assignWith(prev, curr, function (pVal, cVal) {
                            if (pVal) {
                                pVal.push(cVal);
                                return pVal;
                            }
                            return [cVal];
                        });
                    }, {});
                    //   console.log("mergedData",mergedData);
                    //Convert object keyed by dimension values into an array
                    //of objects {target: <dimVal>, datapoints: <metric time series>}
                    return lodash_1.default.map(mergedData, function (vals, key) {
                        /*
                         var postagg:any={};
                         var ref_agg,exp,refkey:any=[];
                         trg.postAggregators=trg.postAggregators||[];
                         trg.postAggregators1=trg.postAggregators1||[];
                         var combined_postaggs=trg.postAggregators.concat(trg.postAggregators1);
                         if (combined_postaggs.length==1){
                            ref_agg=combined_postaggs[0].refId;
                            exp= combined_postaggs[0].expression;
                             if (combined_postaggs[0].refKey) refkey=combined_postaggs[0].refKey;
                         }*/
                        /* if (postagg=_.find(combined_postaggs,function(x) {
                           console.log("x name and key",x.name,key);
                           return x.name==key;
                         }) ) {
                            ref_agg=postagg.refId;
                            exp= postagg.expression;
                           if (postagg.refKey) refkey=postagg.refKey; //if (postagg.refKey.length==1) refkey=postagg.refKey[0];
                         
                         }*/
                        var topNJoinData = {
                            expression: trg.topNJoinExpression,
                            period: period,
                            metric: metric
                        };
                        if (trg.queryType != "topNJoin") topNJoinData = null;
                        return {
                            /* timeShift:trg.timeShift,
                             refId: trg.refId,
                             refAgg:ref_agg,
                             refKey: refkey,
                             expression:exp, */
                            timeShift: trg.timeShift,
                            topNJoinData: topNJoinData,
                            //  expression:trg.topNJoinExpression,
                            // period:period,
                            // queryType:trg.queryType,
                            target: key,
                            datapoints: vals
                        };
                    });
                };
                DruidDatasource.prototype.convertGroupByData = function (md, groupBy, metrics) {
                    var mergedData = md.map(function (item) {
                        /*
                         The first map() transforms the list Druid events into a list of objects
                         with keys of the form "<groupName>:<metric>" and values
                         of the form [metricValue, unixTime]
                         */
                        var groupName = DruidDatasource.getGroupName(groupBy, item);
                        var keys = metrics.map(function (metric) {
                            return groupName + ":" + metric;
                        });
                        var vals = metrics.map(function (metric) {
                            return [item.event[metric], DruidDatasource.formatTimestamp(item.timestamp)];
                        });
                        return lodash_1.default.zipObject(keys, vals);
                    }).reduce(function (prev, curr) {
                        /*
                         Reduce() collapses all of the mapped objects into a single
                         object.  The keys are still of the form "<groupName>:<metric>"
                         and the values are arrays of all the values for the same key.
                         The _.assign() function merges objects together and it's callback
                         gets invoked for every key,value pair in the source (2nd argument).
                         Since our initial value for reduce() is an empty object,
                         the _.assign() callback will get called for every new val
                         that we add to the final object.
                         */
                        return lodash_1.default.assignWith(prev, curr, function (pVal, cVal) {
                            if (pVal) {
                                pVal.push(cVal);
                                return pVal;
                            }
                            return [cVal];
                        });
                    }, {});
                    return lodash_1.default.map(mergedData, function (vals, key) {
                        /*
                         Second map converts the aggregated object into an array
                         */
                        return {
                            target: key,
                            datapoints: vals
                        };
                    });
                };
                DruidDatasource.prototype.convertSelectData = function (data) {
                    var resultList = lodash_1.default.map(data, "result");
                    var eventsList = lodash_1.default.map(resultList, "events");
                    var eventList = lodash_1.default.flatten(eventsList);
                    var result = {};
                    for (var i = 0; i < eventList.length; i++) {
                        var event = eventList[i].event;
                        var timestamp = event.timestamp;
                        if (lodash_1.default.isEmpty(timestamp)) {
                            continue;
                        }
                        for (var key in Object.keys(event)) {
                            if (key !== "timestamp") {
                                if (!result[key]) {
                                    result[key] = { "target": key, "datapoints": [] };
                                }
                                result[key].datapoints.push([event[key], timestamp]);
                            }
                        }
                    }
                    return lodash_1.default.values(result);
                };
                DruidDatasource.dateToMoment = function (date, roundUp) {
                    if (date === 'now') {
                        return moment_1.default();
                    }
                    date = dateMath.parse(date, roundUp);
                    return moment_1.default(date.valueOf());
                };
                DruidDatasource.prototype.computeGranularity = function (from, to, maxDataPoints) {
                    var intervalSecs = to.unix() - from.unix();
                    /*
                     Find the smallest granularity for which there
                     will be fewer than maxDataPoints
                     */
                    var granularityEntry = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (gEntry) {
                        if (gEntry[0] == "all") return true;
                        return Math.ceil(intervalSecs / gEntry[1].asSeconds()) <= maxDataPoints;
                    });
                    if (granularityEntry[0] != "all") console.log("Calculated \"" + granularityEntry[0] + "\" granularity [" + Math.ceil(intervalSecs / granularityEntry[1].asSeconds()) + " pts]" + " for " + (intervalSecs / 60).toFixed(0) + " minutes and max of " + maxDataPoints + " data points");
                    return granularityEntry;
                };
                DruidDatasource.prototype.roundUpStartTime = function (from, granularity) {
                    var duration = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (gEntry) {
                        return gEntry[0] === granularity;
                    })[1];
                    var rounded = moment_1.default(Math.ceil(+from / +duration) * +duration);
                    console.log("Rounding up start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
                    return rounded;
                };
                DruidDatasource.prototype.roundDownStartTime = function (from, granularity) {
                    var duration = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (gEntry) {
                        return gEntry[0] === granularity;
                    })[1];
                    var rounded = moment_1.default(Math.floor(+from / +duration) * +duration);
                    console.log("Rounding down start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
                    return rounded;
                };
                DruidDatasource.prototype.roundDownStartTimev2 = function (from, duration) {
                    /**/
                    var rounded = moment_1.default(Math.floor(+from / +duration) * +duration);
                    // console.log("Rounding down start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
                    return rounded;
                };
                /*
                roundDownStartTime(from, granularity) {
                    // var duration = _.find(DruidDatasource.GRANULARITIES, function (gEntry) {
                    //   return gEntry[0] === granularity;
                    // })[1];
                   // console.log("duration",duration);
                    return from.startOf(granularity);//moment(Math.floor((+from) / (+duration)) * (+duration));
                   // console.log("Rounding down start time from " + from.format() + " to " + rounded.format() + " for granularity [" + granularity + "]");
                    
                  }
                */
                /*    (time, granularity){
                 if (granularity.trim()=="thirty_minute" ) time.add(30,"minutes");
                 else if (granularity.trim()=="thirteen_minute" )   time.add(15,"minutes");
                 else if (granularity.trim()=="five_minute" )  time.add(5,"minutes");
                 else time.add(1,granularity);
                
                
                  }*/
                DruidDatasource.prototype.addDuration = function (time, duration, granularity) {
                    if (granularity.trim().charAt(0) == "h") time.add(duration, "hours");else if (granularity.trim().charAt(0) == "d") time.add(duration, "days");
                };
                DruidDatasource.prototype.convertisoDateTime = function (str) {
                    var tmp = moment_1.default.duration(str).asSeconds;
                    if (tmp == 60) return "minute";else if (tmp == 60 * 60) return "hour";else if (tmp == 60 * 60 * 24) return "day";else if (tmp == 2592000) return "month";else if (tmp == 31536000) return "year";
                };
                DruidDatasource.prototype.parseDuration = function (duration) {
                    var _this = this;
                    var parsed;
                    if (duration) duration.replace(this.durationRegex, function (_, sign, year, month, day, hour, minute, second, week) {
                        sign = sign ? -1 : 1;
                        var toNumber = function (num) {
                            return parseInt(num, 10) * sign || 0;
                        };
                        parsed = _this.map(toNumber, { year: year, month: month, day: day, hour: hour, minute: minute, second: second, week: week });
                    });
                    if (!parsed) throw new Error("Invalid duration \"" + duration + "\"");
                    return Object.assign(parsed, {
                        /**
                         * Sum or substract parsed duration to given date using UTC logic
                         * Time in the day may be affected by daylight saving time (DST)
                         * Time interval between the date given and returned will be stricly equal to duration
                         *
                         * @param {Date} date: Any valid date
                         * @throws {TypeError} When date is not valid
                         * @returns {Date} New date with duration difference
                         */
                        addUTC: function (date) {
                            this.checkDate(date);
                            return new Date(Date.UTC(date.getUTCFullYear() + parsed.year, date.getUTCMonth() + parsed.month, date.getUTCDate() + parsed.day + parsed.week * 7, date.getUTCHours() + parsed.hour, date.getUTCMinutes() + parsed.minute, date.getUTCSeconds() + parsed.second, date.getUTCMilliseconds()));
                        },
                        /**
                         * Sum or substract parsed duration to date
                         * Time in the day won't be affected by daylight saving time (DST)
                         * Time interval between the date given and returned may be affected by DST and not equal to duration
                         *
                         * @param {Date} date: Any valid date
                         * @throws {TypeError} When date is not valid
                         * @returns {Date} New date with duration difference
                         */
                        add: function (date) {
                            this.checkDate(date);
                            return new Date(date.getFullYear() + parsed.year, date.getMonth() + parsed.month, date.getDate() + parsed.day + parsed.week * 7, date.getHours() + parsed.hour, date.getMinutes() + parsed.minute, date.getSeconds() + parsed.second, date.getMilliseconds());
                        }
                    });
                };
                DruidDatasource.GRANULARITIES = [['minute', moment_1.default.duration(1, 'minute'), { "type": "period", "period": "PT1M", "timeZone": "Etc/UTC" }], ['five_minute', moment_1.default.duration(5, 'minute'), { "type": "period", "period": "PT5M", "timeZone": "Etc/UTC" }], ['fifteen_minute', moment_1.default.duration(15, 'minute'), { "type": "period", "period": "PT15M", "timeZone": "Etc/UTC" }], ['thirty_minute', moment_1.default.duration(30, 'minute'), { "type": "period", "period": "PT30M", "timeZone": "Etc/UTC" }], ['hour', moment_1.default.duration(1, 'hour'), { "type": "period", "period": "PT1H", "timeZone": "Etc/UTC" }], ['day', moment_1.default.duration(1, 'day'), { "type": "period", "period": "P1D", "timeZone": "Etc/UTC" }], ['week', moment_1.default.duration(1, 'week'), { "type": "period", "period": "P1W", "timeZone": "Etc/UTC" }], ['month', moment_1.default.duration(1, 'month'), { "type": "period", "period": "P1M", "timeZone": "Etc/UTC" }], ['quarter', moment_1.default.duration(3, 'month'), { "type": "period", "period": "P3M", "timeZone": "Etc/UTC" }], ['year', moment_1.default.duration(1, 'year'), { "type": "period", "period": "P1Y", "timeZone": "Etc/UTC" }], ['all', null, 'all']];
                return DruidDatasource;
            }();
            exports_1("DruidDatasource", DruidDatasource);
        }
    };
});