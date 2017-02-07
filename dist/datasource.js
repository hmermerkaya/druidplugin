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
System.register(['lodash', 'app/core/utils/datemath', 'moment', 'jsep'], function (exports_1, context_1) {
    "use strict";

    var __moduleName = context_1 && context_1.id;
    var lodash_1, dateMath, moment_1, jsep_1;
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
                        "javascript": lodash_1.default.partialRight(this.replaceTemplateValues, ['function'])
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
                }
                DruidDatasource.prototype.replaceTemplateValues = function (obj, attrList) {
                    var self = this;
                    var substitutedVals = attrList.map(function (attr) {
                        return self.templateSrv.replace(obj[attr]);
                    });
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
                    return this._get('/druid/v2/datasources/' + datasource).then(function (response) {
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
                // Called once per panel (graph)
                DruidDatasource.prototype.query = function (options) {
                    var dataSource = this;
                    console.log("Do query");
                    console.log(options);
                    var refId_MetricNames = [];
                    var promises = options.targets.map(function (target) {
                        var date_from = options.range.from.clone();
                        var date_to = options.range.to.clone();
                        //console.log("target.timeShift",target.timeShift);
                        //console.log("target.prePostAgg",target.currentPrePostAgg);
                        dataSource._timeShiftFromTo(target, "back", date_from, date_to);
                        var from = DruidDatasource.dateToMoment(date_from, false);
                        var to = DruidDatasource.dateToMoment(date_to, true);
                        if (lodash_1.default.isEmpty(target.druidDS) || lodash_1.default.isEmpty(target.aggregators) && lodash_1.default.isEmpty(target.aggregators1) && target.queryType !== "select") {
                            console.log("target.druidDS: " + target.druidDS + ", target.aggregators: " + target.aggregators + target.aggregators1);
                            var d = dataSource.q.defer();
                            d.resolve([]);
                            return d.promise;
                        }
                        var aggregators = dataSource._merge(target.aggregators, target.aggregators1);
                        var postAggregators = dataSource._merge(target.postAggregators, target.postAggregators1);
                        refId_MetricNames.push(lodash_1.default.map(DruidDatasource.getMetricNames(aggregators, postAggregators), function (x) {
                            var tmp = {};
                            tmp[target.refId] = x;
                            return tmp;
                        }));
                        // console.log("target.postAggregatorsss",target.postAggregators,target.postAggregators1);
                        var maxDataPointsByResolution = options.maxDataPoints;
                        var maxDataPointsByConfig = target.maxDataPoints ? target.maxDataPoints : Number.MAX_VALUE;
                        var maxDataPoints = Math.min(maxDataPointsByResolution, maxDataPointsByConfig);
                        var granularity = null;
                        if (target.shouldOverrideGranularity) granularity = lodash_1.default.find(DruidDatasource.GRANULARITIES, function (entry) {
                            return entry[0] === target.customGranularity;
                        });else granularity = dataSource.computeGranularity(from, to, maxDataPoints);
                        //Round up to start of an interval
                        //Width of bar chars in Grafana is determined by size of the smallest interval
                        var roundedFrom = granularity[0] === "all" ? from : dataSource.roundUpStartTime(from, granularity[0]);
                        return dataSource._doQuery(roundedFrom, to, granularity[2], target);
                    });
                    return dataSource.q.all(promises).then(function (results) {
                        var tmp_res = lodash_1.default.flatten(results);
                        // console.log("tmp_res",tmp_res);
                        tmp_res.forEach(function (x) {
                            if (!lodash_1.default.isEmpty(x.refAgg)) {
                                var found = false;
                                tmp_res.forEach(function (y) {
                                    if (y.refId == Object.keys(x.refAgg)[0]) {
                                        if (y.target == x.refAgg[Object.keys(x.refAgg)[0]]) {
                                            if (x.datapoints.length != y.datapoints.length) throw "datasources don't have same granularity";
                                            var tmp_str = x.expression;
                                            var trg_agg = Object.keys(x.refAgg)[0] + "." + x.refAgg[Object.keys(x.refAgg)[0]];
                                            var new_str = tmp_str.replace(new RegExp(trg_agg, "g"), "trgAgg");
                                            //console.log("new_str",new_str);
                                            if (x.refKey) new_str = new_str.replace(new RegExp(x.refKey, "g"), "curr");
                                            tmp_res.forEach(function (k) {
                                                if (k.refId == x.refId) {
                                                    if (!x.refKey || k.target == x.refKey) {
                                                        if (x.datapoints.length == 0) throw "no datapoint exists in this range. Change the range";
                                                        x.datapoints.forEach(function (z, idz, array) {
                                                            if (!x.refKey) {
                                                                var trgAgg = y.datapoints[idz][0];
                                                                var corr = eval(new_str);
                                                                z[0] = corr;
                                                                found = true;
                                                            } else if (k.target == x.refKey) {
                                                                var curr = k.datapoints[idz][0];
                                                                var trgAgg = y.datapoints[idz][0];
                                                                var corr = eval(new_str);
                                                                z[0] = corr;
                                                                found = true;
                                                            }
                                                        });
                                                    }
                                                }
                                            });
                                        }
                                    }
                                });
                                if (!found) throw Object.keys(x.refAgg)[0] + "." + x.refAgg[Object.keys(x.refAgg)[0]] + " does not exist";
                            }
                        });
                        //console.log(".flatten(refId_MetricNames)",_.flatten(refId_MetricNames));
                        var tmp_res1 = lodash_1.default.filter(tmp_res, function (x) {
                            for (var i = 0; i < lodash_1.default.flatten(refId_MetricNames).length; i++) {
                                var tmp = {};
                                tmp[x.refId] = x.target;
                                if (lodash_1.default.isEqual(lodash_1.default.flatten(refId_MetricNames)[i], tmp)) return true;
                            }
                            return false;
                        });
                        tmp_res1.forEach(function (x) {
                            if (x.timeShift) x.target = x.target + "_" + x.timeShift + "_shift";
                            x.datapoints.forEach(function (y) {
                                var date = DruidDatasource.dateToMoment(new Date(y[1]), false);
                                dataSource._timeShiftFromTo(x, "forth", date);
                                if (x.timeShift) y[1] = date.valueOf();
                            });
                        });
                        // console.log("tmp_res",tmp_res);
                        return { data: tmp_res1 };
                    });
                };
                DruidDatasource.prototype._doQuery = function (from, to, granularity, target) {
                    var _this = this;
                    var self = this;
                    var datasource = target.druidDS;
                    var filters = target.filters;
                    //target.postAggregators=target.postAggregators||[];
                    var aggregators = this._merge(target.aggregators, target.aggregators1);
                    var postAggregators = this._merge(target.postAggregators, target.postAggregators1);
                    //  target.postAggregators=target.postAggregators||[];
                    //var postAggregators=target.postAggregators;
                    for (var i = 0; i < postAggregators.length; i++) {
                        var parse_tree;
                        parse_tree = jsep_1.default(postAggregators[i].expression);
                        //console.log("parse_tree",parse_tree);
                        var keys = [],
                            refid = {};
                        this._parseObjectKeys(parse_tree, "name", keys, refid);
                        //console.log("keys",keys);
                        postAggregators[i]["refId"] = refid;
                        postAggregators[i]["refKey"] = keys;
                    }
                    ;
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
                        promise = this._topNQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension).then(function (response) {
                            return self.convertTopNData(response.data, dimension, metric);
                        });
                    } else if (target.queryType === 'groupBy') {
                        limitSpec = DruidDatasource.getLimitSpec(target.limit, target.orderBy);
                        promise = this._groupByQuery(datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec).then(function (response) {
                            return self.convertGroupByData(response.data, groupBy, metricNames);
                        });
                    } else if (target.queryType === 'select') {
                        promise = this._selectQuery(datasource, intervals, granularity, selectDimensions, selectMetrics, filters, selectThreshold);
                        return promise.then(function (response) {
                            return self.convertSelectData(response.data);
                        });
                    } else {
                        promise = this._timeSeriesQuery(datasource, intervals, granularity, filters, aggregators, postAggregators).then(function (response) {
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
                DruidDatasource.prototype._timeSeriesQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators) {
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
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._topNQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, threshold, metric, dimension) {
                    var query = {
                        "queryType": "topN",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "threshold": threshold,
                        "dimension": dimension,
                        "metric": metric,
                        // "metric": {type: "inverted", metric: metric},
                        "aggregations": aggregators,
                        "postAggregations": lodash_1.default.map(postAggregators, function (e) {
                            return e.druidQuery;
                        }),
                        "intervals": intervals
                    };
                    if (filters && filters.length > 0) {
                        var f = this.buildFilterTree(filters);
                        if (f) query["filter"] = f;
                    }
                    return this._druidQuery(query);
                };
                DruidDatasource.prototype._groupByQuery = function (datasource, intervals, granularity, filters, aggregators, postAggregators, groupBy, limitSpec) {
                    var query = {
                        "queryType": "groupBy",
                        "dataSource": datasource,
                        "granularity": granularity,
                        "dimensions": groupBy,
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
                    }
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
                        if (prop == "object") refid[obj.object.name] = obj.property.name;else if (prop == "property") continue;else {
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
                        if (filter.type == "selector") return self.replaceTemplateValues(filter, ['value']);else if (filter.type == "regex") return self.replaceTemplateValues(filter, ['pattern']);else if (filter.type == "javascript") return self.replaceTemplateValues(filter, ['function']);
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
                        var ref_agg, exp, refkey;
                        trg.postAggregators = trg.postAggregators || [];
                        trg.postAggregators1 = trg.postAggregators1 || [];
                        //console.log("trg.postAggregators,trg.postAggregators1",trg.postAggregators,trg.postAggregators);
                        var combined_postaggs = trg.postAggregators.concat(trg.postAggregators1);
                        // console.log("combined_postaggs",combined_postaggs);
                        if (postagg = lodash_1.default.find(combined_postaggs, function (x) {
                            return x.name == metric;
                        })) {
                            ref_agg = postagg.refId;
                            exp = postagg.expression;
                            if (postagg.refKey) if (postagg.refKey.length == 1) refkey = postagg.refKey[0];
                        }
                        //console.log("refId",trg.refId,trg.timeShift,ref_agg,refkey,exp);
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
                DruidDatasource.prototype.convertTopNData = function (md, dimension, metric) {
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
                    var dVals = md.reduce(function (dValsSoFar, tsItem) {
                        var dValsForTs = lodash_1.default.map(tsItem.result, dimension);
                        return lodash_1.default.union(dValsSoFar, dValsForTs);
                    }, {});
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
                            return [val, timestamp];
                        });
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
                        return lodash_1.default.assign(prev, curr, function (pVal, cVal) {
                            if (pVal) {
                                pVal.push(cVal);
                                return pVal;
                            }
                            return [cVal];
                        });
                    }, {});
                    //Convert object keyed by dimension values into an array
                    //of objects {target: <dimVal>, datapoints: <metric time series>}
                    return lodash_1.default.map(mergedData, function (vals, key) {
                        return {
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
                        return lodash_1.default.assign(prev, curr, function (pVal, cVal) {
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
                DruidDatasource.GRANULARITIES = [['minute', moment_1.default.duration(1, 'minute'), { "type": "period", "period": "PT1M", "timeZone": "Etc/UTC" }], ['five_minute', moment_1.default.duration(5, 'minute'), { "type": "period", "period": "PT5M", "timeZone": "Etc/UTC" }], ['fifteen_minute', moment_1.default.duration(15, 'minute'), { "type": "period", "period": "PT15M", "timeZone": "Etc/UTC" }], ['thirty_minute', moment_1.default.duration(30, 'minute'), { "type": "period", "period": "PT30M", "timeZone": "Etc/UTC" }], ['hour', moment_1.default.duration(1, 'hour'), { "type": "period", "period": "PT60M", "timeZone": "Etc/UTC" }], ['day', moment_1.default.duration(1, 'day'), { "type": "period", "period": "PT1440M", "timeZone": "Etc/UTC" }], ['all', null, 'all']];
                return DruidDatasource;
            }();
            exports_1("DruidDatasource", DruidDatasource);
        }
    };
});