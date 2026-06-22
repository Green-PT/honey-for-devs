"use strict";

const HEADER = "!eso/1";
const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function assertName(name) {
  if (!NAME.test(name)) throw new TypeError(`Invalid ESO name: ${name}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function json(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("ESO only supports finite numbers");
    return Object.is(value, -0) ? "-0" : JSON.stringify(value);
  }
  if (!Array.isArray(value) && !isRecord(value)) {
    throw new TypeError(`Unsupported ESO value: ${typeof value}`);
  }
  if (seen.has(value)) throw new TypeError("ESO does not support cyclic values");
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw new TypeError("ESO does not support sparse arrays");
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
  if (typeof value !== "string" && !Array.isArray(value) && !isRecord(value)) {
    throw new TypeError(`Unsupported ESO value: ${typeof value}`);
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
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) throw new SyntaxError(`Invalid ESO number: ${text}`);
    return parsed;
  }
  if (/^["[{]/.test(text)) {
    try { return JSON.parse(text); } catch { throw new SyntaxError(`Invalid ESO cell: ${text}`); }
  }
  return text;
}

function encode(input) {
  if (!isRecord(input)) throw new TypeError("ESO document root must be an object");
  const lines = [HEADER];

  for (const [name, data] of Object.entries(input)) {
    assertName(name);
    if (Array.isArray(data)) {
      const records = data.length > 0 && data.every(isRecord);
      if (records) {
        const fields = Object.keys(data[0]);
        fields.forEach(assertName);
        if (!data.every((row) => Object.keys(row).join("\0") === fields.join("\0"))) {
          throw new TypeError(`ESO record array ${name} must have one schema`);
        }
        lines.push(`${name}[${data.length}]{${fields.join(",")}}`);
        for (const row of data) lines.push(fields.map((field) => cell(row[field])).join("\t"));
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
  if (typeof source !== "string") throw new TypeError("ESO source must be a string");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.shift() !== HEADER) throw new SyntaxError(`Expected ${HEADER}`);
  const output = {};

  while (lines.length) {
    const head = lines.shift();
    let match = head.match(/^([A-Za-z_][A-Za-z0-9_.-]*)=(.*)$/);
    if (match) {
      if (Object.hasOwn(output, match[1])) throw new SyntaxError(`Duplicate ESO name: ${match[1]}`);
      Object.defineProperty(output, match[1], {
        value: value(match[2]), enumerable: true, configurable: true, writable: true,
      });
      continue;
    }

    match = head.match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:\[(\d+)\])?(?:\{([^}]*)\})?$/);
    if (!match || (match[2] === undefined && match[3] === undefined)) {
      throw new SyntaxError(`Invalid ESO section: ${head}`);
    }
    const [, name, countText, fieldText] = match;
    if (Object.hasOwn(output, name)) throw new SyntaxError(`Duplicate ESO name: ${name}`);
    const count = countText === undefined ? 1 : Number(countText);
    const fields = fieldText === undefined ? null : fieldText ? fieldText.split(",") : [];
    if (fields) {
      fields.forEach(assertName);
      if (new Set(fields).size !== fields.length) throw new SyntaxError(`Duplicate field in ${name}`);
    }
    if (lines.length < count) throw new SyntaxError(`Section ${name} expected ${count} rows, got ${lines.length}`);

    const rows = lines.splice(0, count).map((line) => {
      if (!fields) return value(line);
      const cells = fields.length === 0 && line === "" ? [] : line.split("\t");
      if (cells.length !== fields.length) {
        throw new SyntaxError(`Section ${name} expected ${fields.length} cells, got ${cells.length}`);
      }
      return Object.fromEntries(fields.map((field, i) => [field, value(cells[i])]));
    });
    Object.defineProperty(output, name, {
      value: countText === undefined ? rows[0] : rows,
      enumerable: true, configurable: true, writable: true,
    });
  }
  return output;
}

module.exports = { decode, encode, isRecord };
