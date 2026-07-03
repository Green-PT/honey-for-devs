"use strict";
// ESON reference implementation (JavaScript). Spec: ../SPEC.md
// Conformance: ../vectors/vectors.json (js/vectors.test.js runs them).

const HEADER = "!eson/1";
const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function assertName(name) {
  if (!NAME.test(name)) throw new TypeError(`Invalid ESON name: ${name}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function json(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("ESON only supports finite numbers");
    return Object.is(value, -0) ? "-0" : JSON.stringify(value);
  }
  if (!Array.isArray(value) && !isRecord(value)) {
    throw new TypeError(`Unsupported ESON value: ${typeof value}`);
  }
  if (seen.has(value)) throw new TypeError("ESON does not support cyclic values");
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw new TypeError("ESON does not support sparse arrays");
    value.forEach((item) => json(item, seen));
  } else {
    Object.values(value).forEach((item) => json(item, seen));
  }
  seen.delete(value);
  return JSON.stringify(value);
}

function cell(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return json(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "string" && !Array.isArray(value) && !isRecord(value)) {
    throw new TypeError(`Unsupported ESON value: ${typeof value}`);
  }
  if (typeof value !== "string") return json(value);
  return value && value === value.trim() && !/[\t\r\n]/.test(value) &&
    !NUMBER.test(value) && !["null", "true", "false"].includes(value) &&
    !/^["[{]/.test(value) ? value : JSON.stringify(value);
}

function value(text) {
  if (text === "null") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (NUMBER.test(text)) {
    if (!/[.eE]/.test(text) && !Number.isSafeInteger(Number(text))) return BigInt(text);
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) throw new SyntaxError(`Invalid ESON number: ${text}`);
    return parsed;
  }
  if (/^["[{]/.test(text)) {
    try { return JSON.parse(text); } catch { throw new SyntaxError(`Invalid ESON cell: ${text}`); }
  }
  return text;
}

// opts.number: prepend a reserved `n` field (1-based row number) to every record
// array — restores positional ("the Nth row") access for LLM readers, which fails
// in every un-numbered format. Decoders verify the sequence like a checksum.
function encode(input, opts = {}) {
  if (!isRecord(input)) throw new TypeError("ESON document root must be an object");
  const lines = [HEADER];

  for (const [name, data] of Object.entries(input)) {
    assertName(name);
    if (Array.isArray(data)) {
      const records = data.length > 0 && data.every(isRecord);
      if (records) {
        let fields = Object.keys(data[0]);
        fields.forEach(assertName);
        if (!data.every((row) => Object.keys(row).join("\0") === fields.join("\0"))) {
          throw new TypeError(`ESON record array ${name} must have one schema`);
        }
        let rows = data;
        if (opts.number) {
          if (fields.includes("n")) throw new TypeError(`ESON record array ${name} already has a field n`);
          fields = ["n", ...fields];
          rows = data.map((row, i) => ({ n: i + 1, ...row }));
        }
        lines.push(`${name}[${data.length}]{${fields.join(",")}}`);
        for (const row of rows) lines.push(fields.map((field) => cell(row[field])).join("\t"));
      } else {
        lines.push(`${name}[${data.length}]`);
        for (const item of data) lines.push(cell(item));
      }
    } else if (isRecord(data)) {
      const fields = Object.keys(data);
      fields.forEach(assertName);
      lines.push(`${name}{${fields.join(",")}}`);
      lines.push(fields.map((field) => cell(data[field])).join("\t"));
    } else {
      lines.push(`${name}=${cell(data)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function decode(source) {
  if (typeof source !== "string") throw new TypeError("ESON source must be a string");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.shift() !== HEADER) throw new SyntaxError(`Expected ${HEADER}`);
  const output = {};

  while (lines.length) {
    const head = lines.shift();
    let match = head.match(/^([A-Za-z_][A-Za-z0-9_.-]*)=(.*)$/);
    if (match) {
      if (Object.hasOwn(output, match[1])) throw new SyntaxError(`Duplicate ESON name: ${match[1]}`);
      Object.defineProperty(output, match[1], {
        value: value(match[2]), enumerable: true, configurable: true, writable: true,
      });
      continue;
    }

    match = head.match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:\[(\d+)\])?(?:\{([^}]*)\})?$/);
    if (!match || (match[2] === undefined && match[3] === undefined)) {
      throw new SyntaxError(`Invalid ESON section: ${head}`);
    }
    const [, name, countText, fieldText] = match;
    if (Object.hasOwn(output, name)) throw new SyntaxError(`Duplicate ESON name: ${name}`);
    const count = countText === undefined ? 1 : Number(countText);
    const fields = fieldText === undefined ? null : fieldText ? fieldText.split(",") : [];
    if (fields) {
      fields.forEach(assertName);
      if (new Set(fields).size !== fields.length) throw new SyntaxError(`Duplicate field in ${name}`);
    }
    if (lines.length < count) throw new SyntaxError(`Section ${name} expected ${count} rows, got ${lines.length}`);

    const numbered = countText !== undefined && fields !== null && fields[0] === "n";
    const rows = lines.splice(0, count).map((line, i) => {
      if (!fields) return value(line);
      const cells = fields.length === 0 && line === "" ? [] : line.split("\t");
      if (cells.length !== fields.length) {
        throw new SyntaxError(`Section ${name} expected ${fields.length} cells, got ${cells.length}`);
      }
      const row = Object.fromEntries(fields.map((field, j) => [field, value(cells[j])]));
      // Reserved n field: a second checksum. Like the [N] count, a wrong sequence
      // means rows were dropped, duplicated, or reordered in transit — fail loudly.
      if (numbered && row.n !== i + 1) {
        throw new SyntaxError(`Section ${name} row ${i + 1} has n=${row.n}; n must be 1-based and sequential`);
      }
      return row;
    });
    Object.defineProperty(output, name, {
      value: countText === undefined ? rows[0] : rows,
      enumerable: true, configurable: true, writable: true,
    });
  }
  return output;
}

// Non-throwing decode for message routers: returns {ok:true,value} or
// {ok:false,error} instead of throwing, so a malformed message can be rejected
// without a try/catch at every call site.
function tryDecode(source) {
  try {
    return { ok: true, value: decode(source) };
  } catch (error) {
    return { ok: false, error };
  }
}

module.exports = { decode, tryDecode, encode, isRecord };
