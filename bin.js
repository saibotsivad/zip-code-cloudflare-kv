#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import { put } from 'httpie'
import sade from 'sade'
import split from 'just-split'

const log = (message, ...parts) => console.log(`[${new Date().toISOString()}] ${message}`, ...parts)

const transformForCountry = (countryCode, { codes }) => {
	const zipCodes = Object.keys(codes || {})
	return zipCodes
		.map(code => ({
			key: `${countryCode}:item:code:${code}`,
			value: JSON.stringify(codes[code]),
		}))
}

const getAllZipData = async ({ prefix }) => {
	log('Loading data...')
	const [
		usCodes,
		// canadaCodes,
	] = await Promise.all([
		import('zipcodes-nrviens/lib/codes.js'),
		// import('zipcodes-nrviens/lib/codesCanada.js'),
	])

	log('Transforming data...')
	let items = [
		...transformForCountry('US', usCodes),
		// ...transformForCountry('CA', canadaCodes),
	]
	if (prefix) {
		items = items.map(item => {
			item.key = prefix + item.key
			return item
		})
	}
	return items
}

const putValues = async ({ accountId, namespaceId, prefix }) => {
	if (!accountId) accountId = process.env.CF_ACCOUNT_ID
	if (!accountId || !namespaceId) {
		log('Must set an account id and KV namespace id.')
		process.exit(1)
	}
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`
	const data = await getAllZipData({ prefix })
	const chunks = split(data, 123)
	let currentChunk = 0
	for (const body of chunks) {
		log(`Writing chunk ${++currentChunk} of ${chunks.length}`)
		let response
		try {
			response = await put(url, {
				body,
				headers: {
					'X-Auth-Key': 'TODO', // TODO
				},
			})
		} catch (error) {
			response = error
		}
		if (!response.data?.success) {
			log('Failed to write chunk to KV.', JSON.stringify(response.data, undefined, 4))
		}
	}
}

const writeValues = async ({ prefix, file }) => {
	const data = await getAllZipData({ prefix })
	await writeFile(file, JSON.stringify(data, undefined, 2), 'utf8')
}

const prog = sade('zip-code-cloudflare-kv')

prog
	.version(JSON.parse(readFileSync('./package.json', 'utf8')).version)
	.option('-p, --prefix', 'Add an additional prefix to all items, e.g. for a shared KV namespace.')
	.option('-i, --include', 'Specify which countries ZIP Codes to use. Available: US, CA', 'US')

prog.command('fill')
	.describe('Fill a Cloudflare KV namespace with ZIP Code details.')
	.option('-a, --accountId', 'Your Cloudflare account id. Overrides the default environment variable "CF_ACCOUNT_ID".')
	.option('-n, --namespaceId', 'The KV namespace identifier to fill with data.')
	.action(props => putValues(props).catch(error => {
		console.error('An error occurred while pushing data to KV.', error)
		process.exit(1)
	}).then(() => process.exit(0)))

prog.command('json <file>')
	.describe('Write entries to disk as JSON for use by the Wrangler "kv:bulk put" command.')
	.action((file, { prefix }) => writeValues({ file, prefix }).catch(error => {
		console.error('An error occurred while writing to disk.', error)
		process.exit(1)
	}).then(() => process.exit(0)))

prog.parse(process.argv)
