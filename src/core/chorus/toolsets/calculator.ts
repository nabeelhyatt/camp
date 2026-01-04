import { Toolset } from "@core/chorus/Toolsets";

/**
 * Token types for the expression parser
 */
type TokenType =
    | "NUMBER"
    | "PLUS"
    | "MINUS"
    | "MULTIPLY"
    | "DIVIDE"
    | "POWER"
    | "MODULO"
    | "LPAREN"
    | "RPAREN"
    | "COMMA"
    | "FUNCTION"
    | "EOF";

interface Token {
    type: TokenType;
    value: string | number;
}

/**
 * Math functions available in expressions
 */
const mathFunctions: Record<string, (...args: number[]) => number> = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    log: Math.log,
    log10: Math.log10,
    exp: Math.exp,
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
};

/**
 * Math constants available in expressions
 */
const mathConstants: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
};

/**
 * Tokenizer: converts expression string into tokens
 */
function tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;
    const expr = expression.replace(/\s+/g, "");

    while (pos < expr.length) {
        const char = expr[pos];

        // Numbers (including decimals and scientific notation)
        if (/[0-9.]/.test(char)) {
            let numStr = "";
            while (pos < expr.length && /[0-9.eE+-]/.test(expr[pos])) {
                // Handle scientific notation sign
                if (
                    (expr[pos] === "+" || expr[pos] === "-") &&
                    numStr.length > 0 &&
                    !/[eE]$/.test(numStr)
                ) {
                    break;
                }
                numStr += expr[pos];
                pos++;
            }
            const num = parseFloat(numStr);
            if (isNaN(num)) {
                throw new Error(`Invalid number: ${numStr}`);
            }
            tokens.push({ type: "NUMBER", value: num });
            continue;
        }

        // Operators
        if (char === "+") {
            tokens.push({ type: "PLUS", value: "+" });
            pos++;
            continue;
        }
        if (char === "-") {
            tokens.push({ type: "MINUS", value: "-" });
            pos++;
            continue;
        }
        if (char === "*") {
            tokens.push({ type: "MULTIPLY", value: "*" });
            pos++;
            continue;
        }
        if (char === "/") {
            tokens.push({ type: "DIVIDE", value: "/" });
            pos++;
            continue;
        }
        if (char === "^") {
            tokens.push({ type: "POWER", value: "^" });
            pos++;
            continue;
        }
        if (char === "%") {
            tokens.push({ type: "MODULO", value: "%" });
            pos++;
            continue;
        }
        if (char === "(") {
            tokens.push({ type: "LPAREN", value: "(" });
            pos++;
            continue;
        }
        if (char === ")") {
            tokens.push({ type: "RPAREN", value: ")" });
            pos++;
            continue;
        }
        if (char === ",") {
            tokens.push({ type: "COMMA", value: "," });
            pos++;
            continue;
        }

        // Functions and constants (alphabetic)
        if (/[a-zA-Z]/.test(char)) {
            let name = "";
            while (pos < expr.length && /[a-zA-Z0-9]/.test(expr[pos])) {
                name += expr[pos];
                pos++;
            }
            const lowerName = name.toLowerCase();

            // Check if it's a constant
            if (lowerName in mathConstants) {
                tokens.push({
                    type: "NUMBER",
                    value: mathConstants[lowerName],
                });
                continue;
            }

            // Check if it's a function
            if (lowerName in mathFunctions) {
                tokens.push({ type: "FUNCTION", value: lowerName });
                continue;
            }

            throw new Error(`Unknown identifier: ${name}`);
        }

        throw new Error(`Unexpected character: ${char}`);
    }

    tokens.push({ type: "EOF", value: "" });
    return tokens;
}

/**
 * Recursive descent parser for mathematical expressions
 * Grammar:
 *   expression := term (('+' | '-') term)*
 *   term := power (('*' | '/' | '%') power)*
 *   power := unary ('^' power)?
 *   unary := ('-' | '+')? primary
 *   primary := NUMBER | FUNCTION '(' arguments ')' | '(' expression ')'
 *   arguments := expression (',' expression)*
 */
class Parser {
    private tokens: Token[];
    private pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private current(): Token {
        return this.tokens[this.pos];
    }

    private consume(type: TokenType): Token {
        const token = this.current();
        if (token.type !== type) {
            throw new Error(`Expected ${type}, got ${token.type}`);
        }
        this.pos++;
        return token;
    }

    private match(...types: TokenType[]): boolean {
        return types.includes(this.current().type);
    }

    parse(): number {
        const result = this.expression();
        if (this.current().type !== "EOF") {
            throw new Error(`Unexpected token: ${this.current().value}`);
        }
        return result;
    }

    private expression(): number {
        let left = this.term();

        while (this.match("PLUS", "MINUS")) {
            const op = this.current().type;
            this.pos++;
            const right = this.term();
            if (op === "PLUS") {
                left = left + right;
            } else {
                left = left - right;
            }
        }

        return left;
    }

    private term(): number {
        let left = this.power();

        while (this.match("MULTIPLY", "DIVIDE", "MODULO")) {
            const op = this.current().type;
            this.pos++;
            const right = this.power();
            if (op === "MULTIPLY") {
                left = left * right;
            } else if (op === "DIVIDE") {
                if (right === 0) {
                    throw new Error("Division by zero");
                }
                left = left / right;
            } else {
                left = left % right;
            }
        }

        return left;
    }

    private power(): number {
        const base = this.unary();

        if (this.match("POWER")) {
            this.pos++;
            const exponent = this.power(); // Right associative
            return Math.pow(base, exponent);
        }

        return base;
    }

    private unary(): number {
        if (this.match("MINUS")) {
            this.pos++;
            return -this.unary();
        }
        if (this.match("PLUS")) {
            this.pos++;
            return this.unary();
        }
        return this.primary();
    }

    private primary(): number {
        // Number
        if (this.match("NUMBER")) {
            const token = this.consume("NUMBER");
            return token.value as number;
        }

        // Function call
        if (this.match("FUNCTION")) {
            const funcName = this.current().value as string;
            this.pos++;
            this.consume("LPAREN");

            const args: number[] = [];
            if (!this.match("RPAREN")) {
                args.push(this.expression());
                while (this.match("COMMA")) {
                    this.pos++;
                    args.push(this.expression());
                }
            }
            this.consume("RPAREN");

            const func = mathFunctions[funcName];
            return func(...args);
        }

        // Parenthesized expression
        if (this.match("LPAREN")) {
            this.consume("LPAREN");
            const result = this.expression();
            this.consume("RPAREN");
            return result;
        }

        throw new Error(`Unexpected token: ${this.current().value}`);
    }
}

/**
 * Safely evaluates a mathematical expression using recursive descent parsing.
 * Supports: +, -, *, /, ^, %, parentheses, and common math functions.
 */
function evaluateExpression(expression: string): number {
    const tokens = tokenize(expression);
    const parser = new Parser(tokens);
    const result = parser.parse();

    if (!isFinite(result)) {
        throw new Error(`Result is not a valid number: ${result}`);
    }

    return result;
}

export class ToolsetCalculator extends Toolset {
    constructor() {
        super(
            "calculator",
            "Calculator",
            {},
            "Perform precise mathematical calculations",
            "",
        );

        this.addCustomTool(
            "evaluate",
            {
                type: "object",
                properties: {
                    expression: {
                        type: "string",
                        description:
                            "Mathematical expression to evaluate. Supports: basic operators (+, -, *, /, ^, %), parentheses, and functions (sqrt, abs, round, floor, ceil, sin, cos, tan, log, log10, exp, pow, min, max). Constants: pi, e. Examples: '2 + 2', '(10 * 5) / 2', 'sqrt(16)', 'pow(2, 10)', '100 * (1 + 0.05)^12'",
                    },
                },
                required: ["expression"],
                additionalProperties: false,
            },
            (args) => {
                const expression = args.expression as string;
                const result = evaluateExpression(expression);
                return Promise.resolve(`${expression} = ${result}`);
            },
            "Evaluates a mathematical expression and returns the result. Useful for precise arithmetic, financial calculations (compound interest, NPV), percentages, and any math that requires accuracy. Always use this tool instead of trying to calculate in your head.",
        );
    }
}
