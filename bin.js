#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

import { put } from 'httpie'
import sade from 'sade'
import split from 'just-split'

const MAX_BULK_BYTES = 99000000 // 100mb so just under it a bit
const MAX_BULK_ITEMS = 10000

const log = (message, ...parts) => console.log(`[${new Date().toISOString()}] ${message}`, ...parts)

const generators = {
	zipLookup: (countryCode, { codes }) => {
		const zipCodes = Object.keys(codes || {})
		return zipCodes
			.map(code => ({
				key: `${countryCode}:i:zip:${code}`,
				value: JSON.stringify(codes[code]),
			}))
	},
}

const transformForCountry = (countryCode, data) => {
	const output = []
	for (const keyType in generators) {
		output.push(...generators[keyType](countryCode, data))
	}
	return output
}

const getAllZipData = async ({ prefix }) => {
	log('Loading data...')
	const [
		usData,
		// canadaData,
	] = await Promise.all([
		import('zipcodes-nrviens/lib/codes.js'),
		// import('zipcodes-nrviens/lib/codesCanada.js'),
	])

	log('Transforming data...')
	let items = [
		...transformForCountry('US', usData),
		// ...transformForCountry('CA', canadaData),
	]
	if (prefix) {
		items = items.map(item => {
			item.key = prefix + ':' + item.key
			return item
		})
	}
	log(`Loaded ${items.length} Zip Codes.`)
	return items
}

const putValues = async ({ accountId, namespaceId, prefix }) => {
	if (!accountId) accountId = process.env.CF_ACCOUNT_ID
	if (!accountId || !namespaceId) {
		log('Must set an account id and KV namespace id.')
		process.exit(1)
	}
	const apiToken = process.env.CF_API_TOKEN
	if (!apiToken) {
		log('Must set the API token using the environment variable "CF_API_TOKEN".')
		process.exit(1)
	}
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`
	const data = await getAllZipData({ prefix })

	log('Chunking data...')
	const chunks = [ [] ]
	let totalBytes = 0
	let lastChunkSize = 0
	for (const items of split(data, 100)) {
		const itemsSize = JSON.stringify(items).length // not quite accurate but close enough
		const countOfLastChunkPlusThese = chunks[chunks.length - 1].length + itemsSize
		if (((lastChunkSize + itemsSize) > MAX_BULK_BYTES) || countOfLastChunkPlusThese > MAX_BULK_ITEMS) {
			chunks.push(items)
			lastChunkSize = itemsSize
			totalBytes += itemsSize
		} else {
			chunks[chunks.length - 1].push(...items)
			lastChunkSize += itemsSize
			totalBytes += itemsSize
		}
	}
	log(`Writing ${data.length} items in ${chunks.length} chunk${chunks.length > 1 ? 's' : ''} (about ${Math.round(totalBytes / 100000) / 10}MB total).`)

	let currentChunk = 0
	for (const body of chunks) {
		log(`Writing chunk ${++currentChunk} of ${chunks.length}`)
		let response
		try {
			response = await put(url, {
				body,
				headers: {
					'Authorization': `Bearer ${apiToken}`,
				},
			})
		} catch (error) {
			response = error
		}
		if (!response.data?.success) {
			log('Failed to write chunk to KV.', JSON.stringify(response.data, undefined, 4))
			process.exit(1)
		}
	}
}

const writeValues = async ({ prefix, file }) => {
	const data = await getAllZipData({ prefix })
	await writeFile(file, JSON.stringify(data, undefined, 2), 'utf8')
}

const writeMiniflare = async ({ namespace, prefix, folder }) => {
	const items = await getAllZipData({ prefix })
	const now = Date.now()
	for (const item of items) {
		const fileParts = item.key.split(':')
		const file = fileParts.pop()
		const fileFolder = join(folder, namespace, ...fileParts)
		await mkdir(fileFolder, { recursive: true })
		await writeFile(join(fileFolder, file.toString()), item.value, 'utf8')
		await writeFile(join(fileFolder, `${file}.meta.json`), JSON.stringify({ key: item.key }), 'utf8')
	}
	log(`Finished writing after ${Date.now() - now}ms`)
}

const prog = sade('zip-code-cloudflare-kv')

prog
	.version(JSON.parse(readFileSync('./package.json', 'utf8')).version)
	.option('-p, --prefix', 'Add an additional prefix to all items, e.g. for a shared KV namespace.')
	// .option('-i, --include', 'Specify which countries ZIP Codes to use. Available: US, CA', 'US')

prog.command('fill <namespaceId>')
	.describe('Fill a Cloudflare KV namespace with ZIP Code details.')
	.option('-a, --accountId', 'Your Cloudflare account id. Overrides the default environment variable "CF_ACCOUNT_ID".')
	.action((namespaceId, props) => putValues({ ...props, namespaceId }).catch(error => {
		console.error('An error occurred while pushing data to KV.', error)
		process.exit(1)
	}).then(() => process.exit(0)))

prog.command('json <file>')
	.describe('Write entries to disk as JSON for use by the Wrangler "kv:bulk put" command.')
	.action((file, { prefix }) => writeValues({ file, prefix }).catch(error => {
		console.error('An error occurred while writing to disk.', error)
		process.exit(1)
	}).then(() => process.exit(0)))

prog.command('mf <kvNamespace> <folder>')
	.describe('Write entries to disk for use with Miniflare locally persisted, e.g.: miniflare --kv-persist ./data/')
	.action((namespace, folder, { prefix }) => writeMiniflare({ namespace, folder, prefix }).catch(error => {
		console.error('An error occurred while writing to disk.', error)
		process.exit(1)
	}).then(() => process.exit(0)))

prog.parse(process.argv)
