/* eslint-disable no-console -- Reports starter validation. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verify, validate, parse } from '@agentshouse/mdmodel'
const schema = fs.readFileSync('schema.yaml', 'utf8')
const model = verify(schema)
assert.equal(model.verdict, 'accept')
const documents = {}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink())
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else { assert(entry.isFile() && file.endsWith('.md')); documents[path.relative('starter', file)] = fs.readFileSync(file, 'utf8') }
  }
}
walk('starter')
assert(Object.keys(documents).length > 0)
assert.equal(validate({ 'settings/schema.yaml': schema, ...documents }, { binaryTargets: [] }, model.model).verdict, 'accept')
const { buildSeedChanges, seedRecords } = await import('./donor-seed-data.mjs')
const originals = new Map(buildSeedChanges('example').changes.map(row => [row.path.replace('/rooms/example/', ''), row.content]))
const selected = new Map()
for (const [file, content] of Object.entries(documents)) {
  assert.equal(content, originals.get(file), 'Starter must preserve original licensed example paths and bytes.')
  const result = parse(content, file); assert(result.ok)
  const [, resource, filename] = file.split('/')
  const original = seedRecords[resource].find(row => row.id === filename.slice(0, -3))
  assert(original); selected.set(`${resource}/${original.id}`, original)
}
for (const row of selected.values()) {
  for (const [key, target] of Object.entries({company_id:'companies',contact_id:'contacts',deal_id:'deals',sales_id:'sales'})) {
    if(row[key] != null) assert(selected.has(`${target}/${row[key]}`), `Missing ${key}: ${row[key]}`)
  }
  for(const id of row.contact_ids ?? []) assert(selected.has(`contacts/${id}`))
  for(const id of row.tags ?? []) assert(selected.has(`tags/${id}`))
}
console.log(`PASS: ${selected.size} original licensed starter records with complete references.`)
