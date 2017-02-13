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
System.register(['lodash', 'app/plugins/sdk', 'jsep', 'jquery'], function (exports_1, context_1) {
    "use strict";

    var __moduleName = context_1 && context_1.id;
    var __extends = this && this.__extends || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
    var lodash_1, sdk_1, jsep_1, jquery_1;
    var DruidQueryCtrl;
    return {
        setters: [function (lodash_1_1) {
            lodash_1 = lodash_1_1;
        }, function (sdk_1_1) {
            sdk_1 = sdk_1_1;
        }, function (jsep_1_1) {
            jsep_1 = jsep_1_1;
        }, function (jquery_1_1) {
            jquery_1 = jquery_1_1;
        }],
        execute: function () {
            DruidQueryCtrl = function (_super) {
                __extends(DruidQueryCtrl, _super);
                /** @ngInject **/
                function DruidQueryCtrl($scope, $injector, $q) {
                    var _this = this;
                    _super.call(this, $scope, $injector);
                    this.queryTypeValidators = {
                        "SQL": this.validateSql.bind(this),
                        "timeseries": lodash_1.default.noop.bind(this),
                        "groupBy": this.validateGroupByQuery.bind(this),
                        "topN": this.validateTopNQuery.bind(this),
                        "select": this.validateSelectQuery.bind(this)
                    };
                    this.filterValidators = {
                        "selector": this.validateSelectorFilter.bind(this),
                        "regex": this.validateRegexFilter.bind(this),
                        "javascript": this.validateJavascriptFilter.bind(this)
                    };
                    this.aggregatorValidators = {
                        "count": this.validateCountAggregator,
                        "longSum": lodash_1.default.partial(this.validateSimpleAggregator, 'longSum').bind(this),
                        "doubleSum": lodash_1.default.partial(this.validateSimpleAggregator, 'doubleSum').bind(this),
                        "approxHistogramFold": this.validateApproxHistogramFoldAggregator.bind(this),
                        "hyperUnique": lodash_1.default.partial(this.validateSimpleAggregator, 'hyperUnique').bind(this)
                    };
                    /* aggregatorValidators1 = {
                         "count": this.validateCountAggregator1,
                         "longSum": _.partial(this.validateSimpleAggregator1, 'longSum').bind(this),
                         "doubleSum": _.partial(this.validateSimpleAggregator1, 'doubleSum').bind(this),
                         "approxHistogramFold": this.validateApproxHistogramFoldAggregator1.bind(this),
                         "hyperUnique": _.partial(this.validateSimpleAggregator1, 'hyperUnique').bind(this)
                     };*/
                    this.postAggregatorValidators = {
                        "arithmetic": this.validateArithmeticPostAggregator.bind(this),
                        "quantile": this.validateQuantilePostAggregator.bind(this)
                    };
                    /*  postAggregatorValidators1 = {
                         "arithmetic": this.validateArithmeticPostAggregator.bind(this),
                         "quantile": this.validateQuantilePostAggregator.bind(this)
                     };*/
                    this.arithmeticPostAggregatorFns = { '+': null, '-': null, '*': null, '/': null };
                    this.defaultQueryType = "timeseries";
                    this.defaultFilterType = "selector";
                    this.defaultAggregatorType = "count";
                    this.defaultPostAggregator = { type: 'arithmetic', 'fn': '+', 'druiqQuery': null };
                    this.customGranularities = ['minute', 'five_minute', 'fifteen_minute', 'thirty_minute', 'hour', 'day', 'all'];
                    this.defaultCustomGranularity = 'minute';
                    this.defaultSelectDimension = "";
                    this.defaultSelectMetric = "";
                    this.defaultLimit = 5;
                    this.jsonFile = '/public/plugins/hmermerkaya-druid-datasource/' + this.panelCtrl.datasource.name + ".json";
                    if (!this.target.queryType) {
                        this.target.queryType = this.defaultQueryType;
                    }
                    this.queryTypes = lodash_1.default.keys(this.queryTypeValidators);
                    this.filterTypes = lodash_1.default.keys(this.filterValidators);
                    this.aggregatorTypes = lodash_1.default.keys(this.aggregatorValidators);
                    this.postAggregatorTypes = lodash_1.default.keys(this.postAggregatorValidators);
                    this.arithmeticPostAggregator = lodash_1.default.keys(this.arithmeticPostAggregatorFns);
                    this.customGranularity = this.customGranularities;
                    this.errors = this.validateTarget();
                    if (!this.target.currentFilter) {
                        this.clearCurrentFilter();
                    }
                    if (!this.target.currentSelect) {
                        this.target.currentSelect = {};
                        this.clearCurrentSelectDimension();
                        this.clearCurrentSelectMetric();
                    }
                    if (!this.target.currentAggregator) {
                        this.clearCurrentAggregator();
                    }
                    /* if (!this.target.currentAggregator1) {
                         this.clearCurrentAggregator1();
                     }*/
                    if (!this.target.currentPostAggregator) {
                        this.clearCurrentPostAggregator();
                    }
                    /* if (!this.target.currentPostAggregator1) {
                         this.clearCurrentPostAggregator1();
                     }*/
                    if (!this.target.customGranularity) {
                        this.target.customGranularity = this.defaultCustomGranularity;
                    }
                    if (!this.target.limit) {
                        this.target.limit = this.defaultLimit;
                    }
                    // needs to be defined here as it is called from typeahead
                    this.listDataSources = function (query, callback) {
                        _this.datasource.getDataSources().then(callback);
                    };
                    this.getDimensions = function (query, callback) {
                        return _this.datasource.getDimensionsAndMetrics(_this.target.druidDS).then(function (dimsAndMetrics) {
                            callback(dimsAndMetrics.dimensions);
                        });
                    };
                    this.getMetrics = function (query, callback) {
                        return _this.datasource.getDimensionsAndMetrics(_this.target.druidDS).then(function (dimsAndMetrics) {
                            callback(dimsAndMetrics.metrics);
                        });
                    };
                    this.getDimensionsAndMetrics = function (query, callback) {
                        console.log("getDimensionsAndMetrics.query: " + query);
                        _this.datasource.getDimensionsAndMetrics(_this.target.druidDS).then(callback);
                    };
                    //this.$on('typeahead-updated', function() {
                    //  $timeout(this.targetBlur);
                    //});
                }
                DruidQueryCtrl.prototype.readTextFile_ajax = function (file) {
                    var json = null;
                    jquery_1.default.ajax({
                        'async': false,
                        'cache': false,
                        'global': false,
                        'url': file,
                        'dataType': "json",
                        'success': function (data) {
                            json = data;
                        }
                    });
                    console.log("json file", json);
                    return json;
                };
                DruidQueryCtrl.prototype.parseObjectKeys = function (obj, name, keys, refid) {
                    for (var prop in obj) {
                        if (prop == "object") refid.push(obj.object.name);else {
                            var sub = obj[prop];
                            // console.log("prop[name]",prop);
                            if (prop == name) {
                                keys.push(obj[name]);
                            }
                        }
                        if (typeof sub == "object") {
                            this.parseObjectKeys(sub, name, keys, refid);
                        }
                    }
                };
                DruidQueryCtrl.prototype.findObjectKey = function (obj, prop) {
                    for (var p in obj) {
                        if (obj.hasOwnProperty(p)) {
                            if (p === prop) {
                                return obj;
                            } else if (obj[p] instanceof Object && this.findObjectKey(obj[p], prop)) {
                                return obj[p];
                            }
                        }
                    }
                    return null;
                };
                DruidQueryCtrl.prototype.cachedAndCoalesced = function (ioFn, $scope, cacheName) {
                    var promiseName = cacheName + "Promise";
                    if (!$scope[cacheName]) {
                        console.log(cacheName + ": no cached value to use");
                        if (!$scope[promiseName]) {
                            console.log(cacheName + ": making async call");
                            $scope[promiseName] = ioFn().then(function (result) {
                                $scope[promiseName] = null;
                                $scope[cacheName] = result;
                                return $scope[cacheName];
                            });
                        } else {
                            console.log(cacheName + ": async call already in progress...returning same promise");
                        }
                        return $scope[promiseName];
                    } else {
                        console.log(cacheName + ": using cached value");
                        var deferred; // = $q.defer();
                        deferred.resolve($scope[cacheName]);
                        return deferred.promise;
                    }
                };
                DruidQueryCtrl.prototype.targetBlur = function () {
                    this.errors = this.validateTarget();
                    this.refresh();
                };
                // ------  filter  -----------
                DruidQueryCtrl.prototype.addFilter = function () {
                    if (!this.addFilterMode) {
                        //Enabling this mode will display the filter inputs
                        this.addFilterMode = true;
                        return;
                    }
                    if (!this.target.filters) {
                        this.target.filters = [];
                    }
                    this.target.errors = this.validateTarget();
                    if (!this.target.errors.currentFilter) {
                        //Add new filter to the list
                        this.target.filters.push(this.target.currentFilter);
                        this.clearCurrentFilter();
                        this.addFilterMode = false;
                    }
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.editFilter = function (index) {
                    this.addFilterMode = true;
                    var delFilter = this.target.filters.splice(index, 1);
                    this.target.currentFilter = delFilter[0];
                };
                DruidQueryCtrl.prototype.removeFilter = function (index) {
                    this.target.filters.splice(index, 1);
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.clearCurrentFilter = function () {
                    this.target.currentFilter = { type: this.defaultFilterType };
                    this.addFilterMode = false;
                    this.targetBlur();
                };
                // ------ dimension -------------------
                DruidQueryCtrl.prototype.addSelectDimensions = function () {
                    if (!this.addDimensionsMode) {
                        this.addDimensionsMode = true;
                        return;
                    }
                    if (!this.target.selectDimensions) {
                        this.target.selectDimensions = [];
                    }
                    this.target.selectDimensions.push(this.target.currentSelect.dimension);
                    this.clearCurrentSelectDimension();
                };
                DruidQueryCtrl.prototype.editDimension = function (index) {
                    this.addDimensionsMode = true;
                    var delDimensions = this.target.selectDimensions.splice(index, 1);
                    this.target.currentSelect.dimension = delDimensions[0];
                };
                DruidQueryCtrl.prototype.removeSelectDimension = function (index) {
                    this.target.selectDimensions.splice(index, 1);
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.clearCurrentSelectDimension = function () {
                    this.target.currentSelect.dimension = this.defaultSelectDimension;
                    this.addDimensionsMode = false;
                    this.targetBlur();
                };
                // ------ metric --------------------
                DruidQueryCtrl.prototype.addSelectMetrics = function (display) {
                    if (!this.addMetricsMode) {
                        this.addMetricsMode = true;
                        return;
                    }
                    if (!this.target.selectMetrics) {
                        this.target.selectMetrics = [];
                    }
                    if (display) this.target.selectMetrics.push(this.target.currentSelect.metric);
                    this.clearCurrentSelectMetric();
                };
                DruidQueryCtrl.prototype.editSelectMetrics = function (index) {
                    this.addMetricsMode = true;
                    var delSelectMetrics = this.target.selectMetrics.splice(index, 1);
                    this.target.currentSelect.metric = delSelectMetrics[0];
                };
                DruidQueryCtrl.prototype.removeSelectMetric = function (index) {
                    this.target.selectMetrics.splice(index, 1);
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.clearCurrentSelectMetric = function () {
                    this.target.currentSelect.metric = this.defaultSelectMetric;
                    this.addMetricsMode = false;
                    this.targetBlur();
                };
                // --------- aggregator -----------------------
                DruidQueryCtrl.prototype.addAggregator = function () {
                    if (!this.addAggregatorMode) {
                        this.addAggregatorMode = true;
                        return;
                    }
                    if (!this.target.aggregators) {
                        this.target.aggregators = [];
                    }
                    if (!this.target.currentAggregator.display) {
                        this.target.currentAggregator.display = false;
                    }
                    this.target.errors = this.validateTarget();
                    if (!this.target.errors.currentAggregator) {
                        //Add new aggregator to the list
                        this.target.aggregators.push(this.target.currentAggregator);
                        this.clearCurrentAggregator();
                        this.addAggregatorMode = false;
                    }
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.editAggregator = function (index) {
                    this.addAggregatorMode = true;
                    var delAggregators = this.target.aggregators.splice(index, 1);
                    this.target.currentAggregator = delAggregators[0];
                };
                DruidQueryCtrl.prototype.removeAggregator = function (index) {
                    this.target.aggregators.splice(index, 1);
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.clearCurrentAggregator = function () {
                    this.target.currentAggregator = { type: this.defaultAggregatorType };
                    this.addAggregatorMode = false;
                    this.targetBlur();
                };
                /*
                   addAggregator1 () {
                        if (!this.addAggregatorMode1) {
                            this.addAggregatorMode1 = true;
                            return;
                        }
                        if (!this.target.aggregators1) {
                            this.target.aggregators1 = [];
                        }
                        if (!this.target.currentAggregator1.display) {
                            this.target.currentAggregator1.display = false;
                        }
                        //this.target.errors = this.validateTarget1();
                      //  console.log("this.target.errors",this.target.errors);
                        if (!this.target.errors.currentAggregator1) {
                            //Add new aggregator to the list
                            this.target.aggregators1.push(this.target.currentAggregator1);
                            this.clearCurrentAggregator1();
                            this.addAggregatorMode1 = false;
                        }
                        this.targetBlur1();
                    };
                
                    editAggregator1 (index) {
                        this.addAggregatorMode1 = true;
                        var delAggregators1 = this.target.aggregators1.splice(index, 1);
                        this.target.currentAggregator1 = delAggregators1[0];
                    };
                    removeAggregator1 (index) {
                        this.target.aggregators1.splice(index, 1);
                        this.targetBlur1();
                    };
                    clearCurrentAggregator1 () {
                        this.target.currentAggregator1 = { type: this.defaultAggregatorType };
                        this.addAggregatorMode1 = false;
                        this.targetBlur1();
                    };
                */
                // ---- post-aggregator ---------
                DruidQueryCtrl.prototype.addPostAggregator = function () {
                    if (!this.addPostAggregatorMode) {
                        this.addPostAggregatorMode = true;
                        return;
                    }
                    if (!this.target.postAggregators) {
                        this.target.postAggregators = [];
                    }
                    // translate expression to Druid query.
                    var parse_tree = jsep_1.default(this.target.currentPostAggregator.expression);
                    var check_obj = false;
                    if (!lodash_1.default.isEmpty(this.findObjectKey(parse_tree, "object"))) check_obj = true;
                    this.target.currentPostAggregator.druidQuery = this.translateToDruid(parse_tree, this.target.currentPostAggregator.name, check_obj);
                    this.target.errors = this.validateTarget();
                    if (!this.target.errors.currentPostAggregator) {
                        //Add new post aggregator to the list
                        this.target.postAggregators.push(this.target.currentPostAggregator);
                        this.clearCurrentPostAggregator();
                        this.addPostAggregatorMode = false;
                    }
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.editPostAggregator = function (index) {
                    this.addPostAggregatorMode = true;
                    var delPostAggregators = this.target.postAggregators.splice(index, 1);
                    this.target.currentPostAggregator = delPostAggregators[0];
                };
                DruidQueryCtrl.prototype.removePostAggregator = function (index) {
                    this.target.postAggregators.splice(index, 1);
                    this.targetBlur();
                };
                DruidQueryCtrl.prototype.clearCurrentPostAggregator = function () {
                    this.target.currentPostAggregator = lodash_1.default.clone(this.defaultPostAggregator);
                    this.addPostAggregatorMode = false;
                    this.targetBlur();
                };
                /*addPostAggregator1 () {
                               
                             
                                 if (!this.addPostAggregatorMode1) {
                        this.addPostAggregatorMode1 = true;
                        return;
                    }
                    if (!this.target.postAggregators1) {
                        this.target.postAggregators1 = [];
                    }
                    // translate expression to Druid query.
                    var parse_tree = jsep(this.target.currentPostAggregator1.expression);
                    this.target.currentPostAggregator1.druidQuery = this.translateToDruid(parse_tree, this.target.currentPostAggregator1.name);
                   // this.target.errors = this.validateTarget1();
                    if (!this.target.errors.currentPostAggregator1) {
                        //Add new post aggregator to the list
                        this.target.postAggregators1.push(this.target.currentPostAggregator1);
                        this.clearCurrentPostAggregator1();
                        this.addPostAggregatorMode1 = false;
                    }
                 //   console.log('this.target.currentPostAggregator1',this.target.currentPostAggregator1);
                    this.targetBlur1();
                };
                editPostAggregator1 (index) {
                    this.addPostAggregatorMode1 = true;
                    var delPostAggregators1 = this.target.postAggregators1.splice(index, 1);
                    this.target.currentPostAggregator1 = delPostAggregators1[0];
                };
                removePostAggregator1  (index) {
                    this.target.postAggregators1.splice(index, 1);
                    this.targetBlur1();
                };
                clearCurrentPostAggregator1  () {
                    this.target.currentPostAggregator1 = _.clone(this.defaultPostAggregator);
                    this.addPostAggregatorMode1 = false;
                    this.targetBlur1();
                };
                         */
                DruidQueryCtrl.prototype.addPredefinedPostAggregator = function () {
                    // console.log("target.PrepostaggsJson", this.target.prePostAggsJSON);
                    // console.log("target.PrepostaggsName", this.target.prePostAggsNames);
                    //  console.log("target.currentPrePostAggName", this.target.currentPrePostAggName);
                    // console.log(this.target.prePostAggsJSON[this.target.druidDS].postaggregations);
                    //console.log("this.panelCtrl 1",this);
                    // console.log("this.panelCtrl 2",this.panelCtrl.datasource.name);
                    //var curPrePostAgg=this.target.currentPrePostAggName;
                    var curPrePostAgg = this.target.currentPrePostAggID;
                    // console.log('curPrePostAgg',curPrePostAgg);
                    var jsonFile_Parsed = this.readTextFile_ajax(this.jsonFile);
                    var found_PrePostAgg;
                    found_PrePostAgg = lodash_1.default.find(jsonFile_Parsed[this.target.druidDS].postaggregations, function (x) {
                        return x.id == curPrePostAgg;
                        //  return x.name == curPrePostAgg;
                    });
                    if (!this.target.aggregators1) this.target.aggregators1 = [];
                    var tmp_aggs = this.target.aggregators1;
                    found_PrePostAgg.aggregations.forEach(function (x) {
                        var found = false;
                        for (var i = 0; i < tmp_aggs.length; i++) {
                            if (tmp_aggs[i].name == x.name) {
                                found = true;
                            }
                        }
                        if (!found) tmp_aggs.push(x);
                    });
                    // console.log("found_prepostagg",found_PrePostAgg);
                    var keys_list = Object.keys(found_PrePostAgg);
                    var postAgg = {};
                    keys_list.forEach(function (x) {
                        if (x != "aggregations") {
                            console.log("found_PreAgg[x]", x, found_PrePostAgg[x]);
                            postAgg[x] = found_PrePostAgg[x];
                        }
                    });
                    console.log("postAgg", postAgg);
                    var parse_tree = jsep_1.default(postAgg.expression);
                    postAgg.druidQuery = this.translateToDruid(parse_tree, postAgg.name);
                    if (!this.target.postAggregators1) this.target.postAggregators1 = [];
                    var postAggs = this.target.postAggregators1;
                    var found = false;
                    this.target.postAggregators1.forEach(function (x) {
                        if (x.id == found_PrePostAgg.id) found = true;
                    });
                    if (!found) this.target.postAggregators1.push(postAgg);
                    this.targetBlur1();
                };
                DruidQueryCtrl.prototype.clearAllPredefinedPostAggregators = function () {
                    if (this.target.postAggregators1.length > 0) {
                        var r = confirm("Are you sure you want to clear all PrePostAggs along with aggregations?");
                        if (r == true) {
                            this.target.aggregators1 = [];
                            this.target.postAggregators1 = [];
                            this.targetBlur1();
                        }
                    }
                };
                DruidQueryCtrl.prototype.clearPredefinedPostAggregator = function () {
                    var json_file = this.readTextFile_ajax(this.jsonFile);
                    var postAggs = json_file[this.target.druidDS].postaggregations;
                    var curPrePostAgg = this.target.currentPrePostAggID;
                    var found_PrePostAgg = postAggs.find(function (x) {
                        return x.id == curPrePostAgg;
                    });
                    var tmp_aggs = this.target.aggregators1;
                    found_PrePostAgg.aggregations.forEach(function (y) {
                        lodash_1.default.remove(tmp_aggs, function (x) {
                            return x.name == y.name;
                        });
                    });
                    var tmp_postAggs = this.target.postAggregators1;
                    lodash_1.default.remove(tmp_postAggs, function (x) {
                        return x.id == curPrePostAgg;
                    });
                    this.targetBlur1();
                };
                DruidQueryCtrl.prototype.targetBlur1 = function () {
                    //  console.log("this.target.aggregators1;",this.target.aggregators1);
                    //  console.log("this.target.postAggregators1",this.target.postAggregators1);
                    this.jsonFile_Parsed = this.readTextFile_ajax(this.jsonFile);
                    if (!lodash_1.default.isEmpty(this.target.druidDS)) {
                        if (this.jsonFile_Parsed.hasOwnProperty(this.target.druidDS)) {
                            this.target.prePostAggsIDs = lodash_1.default.map(this.jsonFile_Parsed[this.target.druidDS].postaggregations, function (val) {
                                return val.id;
                                //  return val.name;
                            });
                        }
                    }
                    if (this.target.druidDS) {
                        var postAggs = this.jsonFile_Parsed[this.target.druidDS].postaggregations;
                        //  console.log(" postAggsggggggggg", postAggs )
                        var postAggsSub = [];
                        postAggs.forEach(function (x, idx) {
                            var tmp_obj = new Object();
                            Object.keys(x).forEach(function (y) {
                                if (y != "aggregations") {
                                    tmp_obj[y] = x[y];
                                }
                            });
                            postAggsSub.push(tmp_obj);
                        });
                        var clone_postaggs = this.target.postAggregators1;
                        var trans = this.translateToDruid.bind(this);
                        postAggsSub.forEach(function (x) {
                            clone_postaggs.forEach(function (y, idy) {
                                if (x.id == y.id) {
                                    if (!lodash_1.default.isEqual(x, y)) {
                                        delete y.druidQuery;
                                        Object.keys(y).forEach(function (z) {
                                            if (z != "aggregations" && z != "name") {
                                                y[z] = x[z];
                                            }
                                        });
                                        var parse_tree = jsep_1.default(y.expression);
                                        y.druidQuery = trans(parse_tree, y.name);
                                    }
                                }
                            });
                        });
                    }
                    // this.errors = this.validateTarget1();
                    this.refresh();
                };
                ;
                DruidQueryCtrl.prototype.addTimeShift = function () {
                    if (!this.target.timeShift) {
                        this.target.timeShift = undefined;
                    }
                    this.targetBlur1();
                    this.targetBlur();
                    var elements = document.getElementsByClassName("graph-legend-alias pointer");
                    var list_el = lodash_1.default.map(elements, function (x) {
                        var str = x.innerHTML;
                        console.log("innerhmtl", str);
                        console.log("str.includes('timeshift')", str.includes('timeshift'));
                        if (str.includes("timeshift")) {
                            var new_str = str.replace('timeshift', '<i class="fa fa-clock-o"></i>');
                            console.log("strrr", new_str);
                            x.innerHTML = new_str;
                            console.log(" x.innerHTML", x.innerHTML);
                        }
                    });
                    console.log("elementss", elements);
                };
                ;
                DruidQueryCtrl.prototype.clearTimeShift = function () {
                    //  this.addTimeShiftMode = false;
                    this.target.timeShift = undefined;
                    this.targetBlur();
                    this.targetBlur1();
                };
                ;
                DruidQueryCtrl.prototype.isValidFilterType = function (type) {
                    return lodash_1.default.has(this.filterValidators, type);
                };
                DruidQueryCtrl.prototype.isValidAggregatorType = function (type) {
                    return lodash_1.default.has(this.aggregatorValidators, type);
                };
                DruidQueryCtrl.prototype.isValidPostAggregatorType = function (type) {
                    return lodash_1.default.has(this.postAggregatorValidators, type);
                };
                DruidQueryCtrl.prototype.isValidQueryType = function (type) {
                    return lodash_1.default.has(this.queryTypeValidators, type);
                };
                DruidQueryCtrl.prototype.isValidArithmeticPostAggregatorFn = function (fn) {
                    return lodash_1.default.has(this.arithmeticPostAggregator, fn);
                };
                DruidQueryCtrl.prototype.validateMaxDataPoints = function (target, errs) {
                    if (target.maxDataPoints) {
                        var intMax = parseInt(target.maxDataPoints);
                        if (isNaN(intMax) || intMax <= 0) {
                            errs.maxDataPoints = "Must be a positive integer";
                            return false;
                        }
                        target.maxDataPoints = intMax;
                    }
                    return true;
                };
                DruidQueryCtrl.prototype.validateLimit = function (target, errs) {
                    if (!target.limit) {
                        errs.limit = "Must specify a limit";
                        return false;
                    }
                    var intLimit = parseInt(target.limit);
                    if (isNaN(intLimit)) {
                        errs.limit = "Limit must be a integer";
                        return false;
                    }
                    target.limit = intLimit;
                    return true;
                };
                DruidQueryCtrl.prototype.validateOrderBy = function (target) {
                    if (target.orderBy && !Array.isArray(target.orderBy)) {
                        target.orderBy = target.orderBy.split(",");
                    }
                    return true;
                };
                DruidQueryCtrl.prototype.validateGroupByQuery = function (target, errs) {
                    if (target.groupBy && !Array.isArray(target.groupBy)) {
                        target.groupBy = target.groupBy.split(",");
                    }
                    if (!target.groupBy) {
                        errs.groupBy = "Must list dimensions to group by.";
                        return false;
                    }
                    if (!this.validateLimit(target, errs) || !this.validateOrderBy(target)) {
                        return false;
                    }
                    return true;
                };
                DruidQueryCtrl.prototype.validateTopNQuery = function (target, errs) {
                    if (!target.dimension) {
                        errs.dimension = "Must specify a dimension";
                        return false;
                    }
                    if (!target.druidMetric) {
                        errs.druidMetric = "Must specify a metric";
                        return false;
                    }
                    console.log(this, this.validateLimit);
                    if (!this.validateLimit(target, errs)) {
                        return false;
                    }
                    return true;
                };
                DruidQueryCtrl.prototype.validateSelectQuery = function (target, errs) {
                    if (!target.selectThreshold && target.selectThreshold <= 0) {
                        errs.selectThreshold = "Must specify a positive number";
                        return false;
                    }
                    return true;
                };
                DruidQueryCtrl.prototype.validateSelectorFilter = function (target) {
                    if (!target.currentFilter.dimension) {
                        return "Must provide dimension name for selector filter.";
                    }
                    if (!target.currentFilter.value) {
                        // TODO Empty string is how you match null or empty in Druid
                        return "Must provide dimension value for selector filter.";
                    }
                    return null;
                };
                DruidQueryCtrl.prototype.validateJavascriptFilter = function (target) {
                    if (!target.currentFilter.dimension) {
                        return "Must provide dimension name for javascript filter.";
                    }
                    if (!target.currentFilter["function"]) {
                        return "Must provide func value for javascript filter.";
                    }
                    return null;
                };
                DruidQueryCtrl.prototype.validateRegexFilter = function (target) {
                    if (!target.currentFilter.dimension) {
                        return "Must provide dimension name for regex filter.";
                    }
                    if (!target.currentFilter.pattern) {
                        return "Must provide pattern for regex filter.";
                    }
                    return null;
                };
                DruidQueryCtrl.prototype.validateCountAggregator = function (target) {
                    if (!target.currentAggregator.name) {
                        return "Must provide an output name for count aggregator.";
                    }
                    return null;
                };
                DruidQueryCtrl.prototype.validateSimpleAggregator = function (type, target) {
                    if (!target.currentAggregator.name) {
                        return "Must provide an output name for " + type + " aggregator.";
                    }
                    if (!target.currentAggregator.fieldName) {
                        return "Must provide a metric name for " + type + " aggregator.";
                    }
                    //TODO - check that fieldName is a valid metric (exists and of correct type)
                    return null;
                };
                DruidQueryCtrl.prototype.validateApproxHistogramFoldAggregator = function (target) {
                    var err = this.validateSimpleAggregator('approxHistogramFold', target);
                    if (err) {
                        return err;
                    }
                    //TODO - check that resolution and numBuckets are ints (if given)
                    //TODO - check that lowerLimit and upperLimit are flots (if given)
                    return null;
                };
                DruidQueryCtrl.prototype.validateSimplePostAggregator = function (type, target) {
                    if (!target.currentPostAggregator.name) {
                        return "Must provide an output name for " + type + " post aggregator.";
                    }
                    if (!target.currentPostAggregator.fieldName) {
                        return "Must provide an aggregator name for " + type + " post aggregator.";
                    }
                    //TODO - check that fieldName is a valid aggregation (exists and of correct type)
                    return null;
                };
                DruidQueryCtrl.prototype.validateQuantilePostAggregator = function (target) {
                    var err = this.validateSimplePostAggregator('quantile', target);
                    if (err) {
                        return err;
                    }
                    if (!target.currentPostAggregator.probability) {
                        return "Must provide a probability for the quantile post aggregator.";
                    }
                    return null;
                };
                DruidQueryCtrl.prototype.translateToField = function (operand, checkObj) {
                    console.log("operand");
                    console.log(JSON.stringify(operand));
                    var output;
                    output = {
                        "type": null
                    };
                    // console.log("checkObj",checkObj);
                    if (!lodash_1.default.isEmpty(operand.object) && !lodash_1.default.isEmpty(operand.property)) {
                        output.type = "constant";
                        output['value'] = 1;
                    } else if (operand.type == "Identifier") {
                        if (lodash_1.default.find(this.target.aggregators, function (entry) {
                            return entry.name == operand.name && entry.type == "hyperUnique";
                        })) output.type = "hyperUniqueCardinality";else output.type = "fieldAccess";
                        if (checkObj) {
                            output.type = "constant";
                            output['value'] = 1;
                        } else {
                            output['name'] = operand.name;
                            output['fieldName'] = operand.name;
                        }
                    } else if (operand.type == "Literal") {
                        output.type = "constant";
                        if (checkObj) output['value'] = 1;else output['value'] = operand.value;
                    } else output = this.translateToDruid(operand, "name", checkObj);
                    return output;
                };
                ;
                // TODO: set target.currentPostAggregator.errors
                DruidQueryCtrl.prototype.translateToDruid = function (parse_tree, name, check_obj) {
                    if (typeof check_obj == "undefined") check_obj = false;
                    return {
                        "name": name,
                        "type": "arithmetic",
                        "fn": parse_tree.operator,
                        "fields": [this.translateToField(parse_tree.left, check_obj), this.translateToField(parse_tree.right, check_obj)]
                    };
                };
                ;
                DruidQueryCtrl.prototype.validateArithmeticPostAggregator = function (target) {
                    if (!target.currentPostAggregator.name) {
                        return "Must provide an output name for arithmetic post aggregator.";
                    }
                    if (!target.currentPostAggregator.expression) {
                        return "Must provide a expression for arithmetic post aggregator.";
                    } else {}
                };
                DruidQueryCtrl.prototype.validateSql = function (target) {
                    // TODO: implement validators
                    return null;
                };
                DruidQueryCtrl.prototype.validateTarget = function () {
                    var validatorOut,
                        errs = {};
                    if (!this.target.druidDS) {
                        errs.druidDS = "You must supply a druidDS name.";
                    }
                    if (!this.target.queryType) {
                        errs.queryType = "You must supply a query type.";
                    } else if (!this.isValidQueryType(this.target.queryType)) {
                        errs.queryType = "Unknown query type: " + this.target.queryType + ".";
                    } else {
                        this.queryTypeValidators[this.target.queryType](this.target, errs);
                    }
                    if (this.target.shouldOverrideGranularity) {
                        if (this.target.customGranularity) {
                            if (!lodash_1.default.includes(this.customGranularity, this.target.customGranularity)) {
                                errs.customGranularity = "Invalid granularity.";
                            }
                        } else {
                            errs.customGranularity = "You must choose a granularity.";
                        }
                    } else {
                        this.validateMaxDataPoints(this.target, errs);
                    }
                    if (this.addFilterMode) {
                        if (!this.isValidFilterType(this.target.currentFilter.type)) {
                            errs.currentFilter = "Invalid filter type: " + this.target.currentFilter.type + ".";
                        } else {
                            validatorOut = this.filterValidators[this.target.currentFilter.type](this.target);
                            if (validatorOut) {
                                errs.currentFilter = validatorOut;
                            }
                        }
                    }
                    if (this.addAggregatorMode) {
                        if (!this.isValidAggregatorType(this.target.currentAggregator.type)) {
                            errs.currentAggregator = "Invalid aggregator type: " + this.target.currentAggregator.type + ".";
                        } else {
                            validatorOut = this.aggregatorValidators[this.target.currentAggregator.type](this.target);
                            if (validatorOut) {
                                errs.currentAggregator = validatorOut;
                            }
                        }
                    }
                    if (lodash_1.default.isEmpty(this.target.aggregators) && !lodash_1.default.isEqual(this.target.queryType, "select")) {
                        errs.aggregators = "You must supply at least one aggregator";
                    }
                    if (this.addPostAggregatorMode) {
                        if (!this.isValidPostAggregatorType(this.target.currentPostAggregator.type)) {
                            errs.currentPostAggregator = "Invalid post aggregator type: " + this.target.currentPostAggregator.type + ".";
                        } else {
                            validatorOut = this.postAggregatorValidators[this.target.currentPostAggregator.type](this.target);
                            if (validatorOut) {
                                errs.currentPostAggregator = validatorOut;
                            }
                        }
                    }
                    return errs;
                };
                DruidQueryCtrl.templateUrl = 'partials/query.editor.html';
                return DruidQueryCtrl;
            }(sdk_1.QueryCtrl);
            exports_1("DruidQueryCtrl", DruidQueryCtrl);
        }
    };
});