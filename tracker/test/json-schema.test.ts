import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileSchema } from './json-schema.ts';

const errors = (schema: object, value: unknown) => compileSchema(schema)(value);

test('type, with one type or several, and integer apart from number', () => {
  assert.deepEqual(errors({ type: 'string' }, 'a'), []);
  assert.deepEqual(errors({ type: 'string' }, 1), ['/ must be string']);
  assert.deepEqual(errors({ type: ['string', 'null'] }, null), []);
  assert.deepEqual(errors({ type: 'integer' }, 2), []);
  assert.deepEqual(errors({ type: 'integer' }, 2.5), ['/ must be integer']);
  assert.deepEqual(errors({ type: 'number' }, 2.5), []);
  assert.deepEqual(errors({ type: 'object' }, []), ['/ must be object']);
  assert.deepEqual(errors({ type: 'array' }, {}), ['/ must be array']);
  assert.deepEqual(errors({ type: 'null' }, 0), ['/ must be null']);
  assert.deepEqual(errors({ type: 'boolean' }, false), []);
});

test('const and enum', () => {
  assert.deepEqual(errors({ const: 1 }, 1), []);
  assert.deepEqual(errors({ const: 1 }, 2), ['/ must be 1']);
  assert.deepEqual(errors({ enum: ['a', null] }, null), []);
  assert.deepEqual(errors({ enum: ['a', null] }, 'b'), [
    '/ must be one of "a", null',
  ]);
});

test('minimum, maximum and pattern', () => {
  const range = { type: 'number', minimum: 0, maximum: 1 };
  assert.deepEqual(errors(range, 0.5), []);
  assert.deepEqual(errors(range, -1), ['/ must be >= 0']);
  assert.deepEqual(errors(range, 2), ['/ must be <= 1']);
  // Bounds only apply to numbers, so a nullable rate accepts null.
  assert.deepEqual(errors({ ...range, type: ['number', 'null'] }, null), []);
  assert.deepEqual(errors({ pattern: '^[a-z]+$' }, 'abc'), []);
  assert.deepEqual(errors({ pattern: '^[a-z]+$' }, 'aB'), [
    '/ must match ^[a-z]+$',
  ]);
});

test('required, properties and additionalProperties', () => {
  const schema = {
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' } },
    additionalProperties: false,
  };
  assert.deepEqual(errors(schema, { a: 'x' }), []);
  assert.deepEqual(errors(schema, {}), ['/ must have required property a']);
  assert.deepEqual(errors(schema, { a: 1 }), ['/a must be string']);
  assert.deepEqual(errors(schema, { a: 'x', b: 1 }), [
    '/ must not have additional property b',
  ]);
  // Extra properties are allowed unless said otherwise, or checked.
  assert.deepEqual(
    errors({ ...schema, additionalProperties: true }, { a: 'x', b: 1 }),
    []
  );
  assert.deepEqual(
    errors({ additionalProperties: { type: 'number' } }, { b: 'no' }),
    ['/b must be number']
  );
});

test('items, $ref to $defs, and every error at once', () => {
  const schema = {
    type: 'array',
    items: { $ref: '#/$defs/point' },
    $defs: {
      point: {
        type: 'object',
        required: ['x', 'y'],
        properties: { x: { type: 'integer' }, y: { type: 'integer' } },
      },
    },
  };
  assert.deepEqual(errors(schema, [{ x: 1, y: 2 }]), []);
  assert.deepEqual(errors(schema, [{ x: 1 }, { x: 'a', y: 2 }]), [
    '/0 must have required property y',
    '/1/x must be integer',
  ]);
});

test('a keyword it does not support fails at once, not silently', () => {
  assert.throws(
    () => compileSchema({ oneOf: [] }),
    /unsupported keyword oneOf/
  );
  assert.throws(
    () => compileSchema({ properties: { a: { minLength: 1 } } }),
    /unsupported keyword minLength at \/properties\/a/
  );
  assert.throws(
    () => compileSchema({ $ref: '#/$defs/none' }),
    /no \$defs\/none/
  );
});
