/**
 * A JSON Schema (2020-12) validator for the subset the Action's own schemas
 * use, so the tests need no third-party package. compileSchema throws on any
 * keyword outside the subset, so a schema can never lean on a check this
 * does not make.
 */

type Schema = Record<string, unknown>;

/** Keywords that only describe, and are not checked. */
const ANNOTATIONS = new Set(['$schema', 'title', 'description', 'format']);
const KEYWORDS = new Set([
  ...ANNOTATIONS,
  '$defs',
  '$ref',
  'type',
  'const',
  'enum',
  'minimum',
  'maximum',
  'pattern',
  'required',
  'properties',
  'additionalProperties',
  'items',
]);

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function hasType(value: unknown, type: string): boolean {
  if (type === 'integer') return Number.isInteger(value);
  return typeOf(value) === type;
}

const show = (value: unknown) => JSON.stringify(value);

/** Throws if the schema, or any schema inside it, uses another keyword. */
function checkKeywords(schema: Schema, at: string, defs: Schema): void {
  for (const [key, value] of Object.entries(schema)) {
    if (!KEYWORDS.has(key)) {
      throw new Error(`unsupported keyword ${key} at ${at || '/'}`);
    }
    if (key === '$ref') {
      const name = /^#\/\$defs\/(.+)$/.exec(String(value))?.[1];
      if (!name || !(name in defs))
        throw new Error(`no $defs/${name ?? value}`);
    }
    if (key === '$defs' || key === 'properties') {
      for (const [name, sub] of Object.entries(value as Schema)) {
        checkKeywords(sub as Schema, `${at}/${key}/${name}`, defs);
      }
    }
    if (
      (key === 'items' || key === 'additionalProperties') &&
      typeof value === 'object'
    ) {
      checkKeywords(value as Schema, `${at}/${key}`, defs);
    }
  }
}

/** A function that returns every way a value breaks the schema. */
export function compileSchema(schema: object): (value: unknown) => string[] {
  const root = schema as Schema;
  const defs = (root.$defs ?? {}) as Schema;
  checkKeywords(root, '', defs);

  function check(schema: Schema, value: unknown, at: string, out: string[]) {
    const where = at || '/';
    if (typeof schema.$ref === 'string') {
      check(
        defs[schema.$ref.slice('#/$defs/'.length)] as Schema,
        value,
        at,
        out
      );
    }
    if (schema.type !== undefined) {
      const types = ([] as string[]).concat(schema.type as string | string[]);
      if (!types.some((t) => hasType(value, t))) {
        out.push(`${where} must be ${types.join(' or ')}`);
        return;
      }
    }
    if ('const' in schema && value !== schema.const) {
      out.push(`${where} must be ${show(schema.const)}`);
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      out.push(`${where} must be one of ${schema.enum.map(show).join(', ')}`);
    }
    if (typeof value === 'number') {
      if (typeof schema.minimum === 'number' && value < schema.minimum) {
        out.push(`${where} must be >= ${schema.minimum}`);
      }
      if (typeof schema.maximum === 'number' && value > schema.maximum) {
        out.push(`${where} must be <= ${schema.maximum}`);
      }
    }
    if (typeof value === 'string' && typeof schema.pattern === 'string') {
      if (!new RegExp(schema.pattern, 'u').test(value)) {
        out.push(`${where} must match ${schema.pattern}`);
      }
    }
    if (Array.isArray(value) && schema.items) {
      value.forEach((item, i) =>
        check(schema.items as Schema, item, `${at}/${i}`, out)
      );
    }
    if (typeOf(value) === 'object') {
      const object = value as Record<string, unknown>;
      const properties = (schema.properties ?? {}) as Record<string, Schema>;
      for (const name of (schema.required ?? []) as string[]) {
        if (!(name in object))
          out.push(`${where} must have required property ${name}`);
      }
      for (const [name, item] of Object.entries(object)) {
        if (name in properties) {
          check(properties[name], item, `${at}/${name}`, out);
        } else if (schema.additionalProperties === false) {
          out.push(`${where} must not have additional property ${name}`);
        } else if (typeof schema.additionalProperties === 'object') {
          check(
            schema.additionalProperties as Schema,
            item,
            `${at}/${name}`,
            out
          );
        }
      }
    }
  }

  return (value) => {
    const out: string[] = [];
    check(root, value, '', out);
    return out;
  };
}
