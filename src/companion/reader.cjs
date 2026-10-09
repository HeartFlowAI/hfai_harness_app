// HeartFlowAI rule package reader v1. Generated from workspace-owned sources.
// Local inspection only; no activation or generated-code execution.
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let node_fs_promises = require("node:fs/promises");
let node_crypto = require("node:crypto");
//#region packages/contracts/index.ts
function decimalToBaseUnits(input, decimals) {
	if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || input.length > 64 || !/^(0|[1-9]\d*)(\.\d+)?$/.test(input)) throw new Error("Enter a plain positive decimal amount.");
	const [whole, fraction = ""] = input.split(".");
	if (fraction.length > decimals) throw new Error(`Use at most ${decimals} decimal places.`);
	const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
	if (units <= 0n) throw new Error("Amount must be greater than zero.");
	if (units > 18446744073709551615n) throw new Error("Amount exceeds the supported base-unit range.");
	return units.toString();
}
//#endregion
//#region packages/contracts/portfolio.ts
/** Validate decoded 32-byte public key length, not just its base58 alphabet. */
function solanaPublicKey(input) {
	if (typeof input !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) throw Error("Enter a valid Solana public address.");
	const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
	let value = 0n;
	for (const char of input) value = value * 58n + BigInt(alphabet.indexOf(char));
	if ((input.match(/^1*/)?.[0].length || 0) + (value === 0n ? 0 : Math.ceil(value.toString(16).length / 2)) !== 32) throw Error("Solana public addresses must decode to 32 bytes.");
	return input;
}
function portfolioProfile(input) {
	if (typeof input !== "string" || input.length < 1 || input.length > 100) throw Error("Invalid local profile.");
	return input;
}
//#endregion
//#region packages/contracts/strategy.ts
const CONDITION_CATALOG = {
	price_usd: {
		label: "USD price",
		unit: "USD",
		source: "DEX Screener pool snapshot",
		coverage: "snapshot",
		window: "Latest quote"
	},
	price_change_pct: {
		label: "Price change over window",
		unit: "%",
		source: "DEX Screener observed quotes",
		coverage: "needs_history",
		window: "User lookback; wait for baseline"
	},
	volume_change_pct: {
		label: "Change in reported 24h volume",
		unit: "%",
		source: "DEX Screener observed rolling h24 volume snapshots",
		coverage: "needs_history",
		window: "User lookback; baseline must be positive; not short-window traded volume"
	},
	volume_24h_usd: {
		label: "Rolling 24h volume",
		unit: "USD",
		source: "DEX Screener h24 volume",
		coverage: "snapshot",
		window: "Fixed rolling 24 hours"
	},
	buys_24h: {
		label: "Rolling 24h buys",
		unit: "integer count",
		source: "DEX Screener h24 buys",
		coverage: "snapshot",
		window: "Fixed rolling 24 hours"
	},
	comments: {
		label: "Comment count",
		unit: "integer count",
		source: "Social provider unavailable",
		coverage: "unavailable",
		window: "User lookback; source missing"
	},
	custom: {
		label: "Custom signal",
		unit: "undefined",
		source: "Custom capability unavailable",
		coverage: "unavailable",
		window: "Unresolved"
	}
};
function object(input) {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Invalid strategy data.");
	return input;
}
function text(input, max) {
	if (typeof input !== "string" || input.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input)) throw Error("Invalid strategy text.");
	return input.trim();
}
function strategyId(input) {
	if (typeof input !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input)) throw Error("Invalid strategy ID.");
	return input;
}
function choice(input, values) {
	if (input === null) return null;
	if (!values.includes(input)) throw Error("Unknown strategy choice.");
	return input;
}
function integer(input) {
	if (input === null) return null;
	if (!Number.isSafeInteger(input) || Math.abs(Number(input)) > 1e8) throw Error("Invalid strategy integer.");
	return Number(input);
}
function decimal(input) {
	return input === null ? null : text(input, 64);
}
function parseStrategySave(input) {
	const p = object(input), s = object(p.spec);
	if (s.version !== 1 || typeof p.reviewed !== "boolean" || !Number.isSafeInteger(p.baseRevision) || Number(p.baseRevision) < 0) throw Error("Unsupported strategy revision.");
	if (!Array.isArray(s.conditions) || s.conditions.length > 8) throw Error("At most eight entry conditions.");
	const conditions = s.conditions.map((raw) => {
		const c = object(raw);
		return {
			id: strategyId(c.id),
			metric: choice(c.metric, Object.keys(CONDITION_CATALOG)),
			operator: choice(c.operator, ["gte", "lte"]),
			threshold: decimal(c.threshold),
			lookbackSeconds: integer(c.lookbackSeconds),
			description: text(c.description, 500)
		};
	});
	if (new Set(conditions.map((c) => c.id)).size !== conditions.length) throw Error("Duplicate condition IDs.");
	const spec = {
		version: 1,
		name: text(s.name, 80),
		intent: text(s.intent, 4e3),
		pool: s.pool === null ? null : solanaPublicKey(s.pool),
		mint: s.mint === null ? null : solanaPublicKey(s.mint),
		logic: choice(s.logic, ["AND", "OR"]),
		conditions,
		sizeCurrency: choice(s.sizeCurrency, ["USD", "SOL"]),
		size: decimal(s.size),
		exitMode: choice(s.exitMode, [
			"stop",
			"take",
			"bracket",
			"manual"
		]),
		stopLossPct: decimal(s.stopLossPct),
		takeProfitPct: decimal(s.takeProfitPct),
		reentry: choice(s.reentry, ["once", "after_exit"]),
		cooldownSeconds: integer(s.cooldownSeconds),
		maxEntries: integer(s.maxEntries),
		cadenceSeconds: integer(s.cadenceSeconds),
		maxSourceAgeSeconds: integer(s.maxSourceAgeSeconds),
		missingData: choice(s.missingData, ["pause"]),
		permission: choice(s.permission, ["approval", "auto"]),
		maxOrderUsd: decimal(s.maxOrderUsd),
		maxStrategyExposureUsd: decimal(s.maxStrategyExposureUsd),
		maxProfileExposureUsd: decimal(s.maxProfileExposureUsd),
		pausePolicy: choice(s.pausePolicy, ["keep_paper", "close_paper"]),
		reportId: s.reportId === null ? null : strategyId(s.reportId),
		gigiTurnId: s.gigiTurnId === null ? null : strategyId(s.gigiTurnId)
	};
	const strategy = p.strategyId === null ? null : strategyId(p.strategyId), baseRevision = Number(p.baseRevision);
	if (strategy === null !== (baseRevision === 0)) throw Error("New strategy needs revision zero; edits need the prior revision.");
	return {
		profileId: portfolioProfile(p.profileId),
		requestId: strategyId(p.requestId),
		strategyId: strategy,
		baseRevision,
		spec,
		reviewed: p.reviewed
	};
}
function strategyIssues(s) {
	const issues = [], add = (field, message, kind = "missing") => issues.push({
		field,
		kind,
		message
	});
	if (!s.name) add("name", "Name this strategy.");
	if (!s.intent) add("intent", "Describe the intended behavior.");
	if (!s.pool || !s.mint) add("asset", "Choose an exact Solana pool and base mint.");
	if (!s.logic) add("logic", "Must all entry signals match (AND), or any (OR)?");
	if (!s.conditions.length) add("conditions", "Add at least one explicit entry rule.");
	for (const c of s.conditions) {
		const field = `condition:${c.id}`;
		if (!c.metric) {
			add(field, "Choose a signal.");
			continue;
		}
		const catalog = CONDITION_CATALOG[c.metric];
		if (catalog.coverage === "unavailable") add(field, `${catalog.label}: required source/capability is unavailable. Preserve this intent until implemented.`, "unsupported");
		if (!c.operator) add(field, "Choose at least / at most.");
		if (c.threshold === null || c.threshold === "") add(field, `Enter the ${catalog.unit} threshold.`);
		else if (c.metric === "buys_24h" || c.metric === "comments") {
			if (!/^\d{1,12}$/.test(c.threshold)) add(field, "Count must be a non-negative integer.", "invalid");
		} else if (c.metric === "price_change_pct" || c.metric === "volume_change_pct") {
			if (!/^-?\d{1,8}(\.\d{1,6})?$/.test(c.threshold) || Number(c.threshold) < -100 || Number(c.threshold) > 1e5) add(field, "Change must be a plain percentage from -100 to 100000.", "invalid");
		} else if (c.metric === "price_usd") {
			if (!/^(0|[1-9]\d{0,17})(\.\d{1,18})?$/.test(c.threshold) || BigInt(c.threshold.replace(".", "")) <= 0n) add(field, "Price threshold must be a positive plain USD decimal, at most 18 decimal places.", "invalid");
		} else if (c.metric !== "custom") try {
			decimalToBaseUnits(c.threshold, 6);
		} catch {
			add(field, "Threshold must be a positive USD decimal, at most six decimal places.", "invalid");
		}
		if (c.metric === "price_change_pct" || c.metric === "volume_change_pct" || c.metric === "comments") {
			if (c.lookbackSeconds === null) add(field, "Set the lookback window in seconds.");
			else if (c.lookbackSeconds < 60 || c.lookbackSeconds > 86400 || s.cadenceSeconds !== null && c.lookbackSeconds < s.cadenceSeconds * 2) add(field, "Lookback must be 60–86400 seconds and at least two evaluation intervals.", "invalid");
		} else if (c.lookbackSeconds !== null) add(field, "This signal has a fixed source window; remove the extra lookback.", "invalid");
		if (c.metric === "custom" && !c.description) add(field, "Describe the custom signal and its units/source.");
	}
	const amounts = /* @__PURE__ */ new Map();
	const amountLabels = {
		size: "the purchase amount",
		maxOrderUsd: "the per-order USD cap",
		maxStrategyExposureUsd: "the strategy exposure USD cap",
		maxProfileExposureUsd: "the proposed profile aggregate USD cap"
	};
	for (const field of [
		"size",
		"maxOrderUsd",
		"maxStrategyExposureUsd",
		"maxProfileExposureUsd"
	]) if (!s[field]) add(field, `Set ${amountLabels[field]}.`);
	else try {
		amounts.set(field, BigInt(decimalToBaseUnits(s[field], 6)));
	} catch {
		add(field, "Enter a positive plain decimal with at most six places.", "invalid");
	}
	if (!s.sizeCurrency) add("sizeCurrency", "Choose the purchase currency.");
	else if (s.sizeCurrency === "SOL") add("sizeCurrency", "SOL-denominated strategies need an explicit conversion/account model. Current strategy paper design uses USD.", "unsupported");
	if (s.sizeCurrency === "USD" && amounts.has("size") && amounts.has("maxOrderUsd") && amounts.get("size") > amounts.get("maxOrderUsd")) add("maxOrderUsd", "Purchase amount exceeds the per-order cap.", "invalid");
	if (amounts.has("maxOrderUsd") && amounts.has("maxStrategyExposureUsd") && amounts.get("maxOrderUsd") > amounts.get("maxStrategyExposureUsd")) add("maxStrategyExposureUsd", "Strategy exposure cap is below its order cap.", "invalid");
	if (amounts.has("maxStrategyExposureUsd") && amounts.has("maxProfileExposureUsd") && amounts.get("maxStrategyExposureUsd") > amounts.get("maxProfileExposureUsd")) add("maxProfileExposureUsd", "Profile exposure cap is below this strategy cap.", "invalid");
	if (!s.exitMode) add("exitMode", "Choose stop-loss, take-profit, bracket or manual exits.");
	for (const [field, required, max] of [[
		"stopLossPct",
		s.exitMode === "stop" || s.exitMode === "bracket",
		100
	], [
		"takeProfitPct",
		s.exitMode === "take" || s.exitMode === "bracket",
		1e5
	]]) if (required && !s[field]) add(field, "Set the exit percentage relative to actual entry fill price.");
	else if (required && (!/^\d{1,8}(\.\d{1,6})?$/.test(s[field]) || Number(s[field]) <= 0 || Number(s[field]) >= max)) add(field, `Exit percentage must be greater than zero and below ${max}.`, "invalid");
	else if (!required && s[field] !== null) add(field, "Remove this threshold for the chosen exit mode.", "invalid");
	if (!s.reentry) add("reentry", "Choose a single entry or re-entry after the prior position closes.");
	if (s.maxEntries === null) add("maxEntries", "Set the total entry count for this strategy run.");
	else if (s.maxEntries < 1 || s.maxEntries > 1e3 || s.reentry === "once" && s.maxEntries !== 1) add("maxEntries", "Entry count must be 1–1000; single-entry mode requires exactly one.", "invalid");
	if (s.reentry === "after_exit" && s.cooldownSeconds === null) add("cooldownSeconds", "Set the cooldown after the prior exit.");
	if (s.cooldownSeconds !== null && (s.cooldownSeconds < 0 || s.cooldownSeconds > 86400)) add("cooldownSeconds", "Cooldown must be 0–86400 seconds.", "invalid");
	if (s.reentry === "once" && s.cooldownSeconds !== null) add("cooldownSeconds", "Single-entry mode has no re-entry cooldown.", "invalid");
	for (const [field, min, max] of [[
		"cadenceSeconds",
		30,
		3600
	], [
		"maxSourceAgeSeconds",
		30,
		300
	]]) if (s[field] === null) add(field, `Set ${field === "cadenceSeconds" ? "the evaluation cadence" : "the maximum age of current source evidence"} in seconds.`);
	else if (s[field] < min || s[field] > max) add(field, `Use ${min}–${max} seconds.`, "invalid");
	if (!s.missingData) add("missingData", "Confirm pausing when required evidence is missing/stale or the baseline is absent.");
	if (!s.permission) add("permission", "Choose approval per trade or automatic paper execution.");
	if (!s.pausePolicy) add("pausePolicy", "Choose whether a requested pause keeps or closes simulated exposure.");
	return issues;
}
function readableStrategy(s) {
	const lines = [
		`Intent: ${s.intent || "unresolved"}`,
		`Asset: Solana mint ${s.mint ?? "unresolved"}; pool ${s.pool ?? "unresolved"}.`,
		`Entry logic: ${s.logic ?? "unresolved"}.`
	];
	for (const c of s.conditions) {
		const m = c.metric ? CONDITION_CATALOG[c.metric] : null;
		lines.push(`${m?.label ?? "Unresolved signal"} ${c.operator === "gte" ? "≥" : c.operator === "lte" ? "≤" : "?"} ${c.threshold ?? "?"} ${m?.unit ?? "?"}; ${m?.source ?? "unknown source"}; ${c.lookbackSeconds === null ? m?.window ?? "window unresolved" : `lookback ${c.lookbackSeconds}s`}.${c.description ? ` User note: ${c.description}` : ""}`);
	}
	lines.push(`Buy ${s.size ?? "?"} ${s.sizeCurrency ?? "?"} in paper mode only.`, `Exit entire strategy position: ${s.exitMode ?? "unresolved"}; stop ${s.stopLossPct ?? "not set"}%, take ${s.takeProfitPct ?? "not set"}% relative to actual entry fill. Manual mode requires a user exit.`, `Re-entry: ${s.reentry ?? "unresolved"}; maximum ${s.maxEntries ?? "?"} entries per run; cooldown ${s.cooldownSeconds ?? "not applicable/unresolved"}s after full exit.`, `Evaluate every ${s.cadenceSeconds ?? "?"}s; required evidence maximum age ${s.maxSourceAgeSeconds ?? "?"}s. Missing/stale/warming-up input policy: ${s.missingData ?? "unresolved"}.`, `Permission: ${s.permission ?? "unresolved"}; order cap $${s.maxOrderUsd ?? "?"}, strategy exposure cap $${s.maxStrategyExposureUsd ?? "?"}, proposed profile aggregate cap $${s.maxProfileExposureUsd ?? "?"}.`, `Requested pause: ${s.pausePolicy ?? "unresolved"}; simulated settlement USD. Interruption requires reconciliation and confirmation; offline/sleep cannot guarantee exits.`);
	return lines;
}
//#endregion
//#region packages/strategies/service.ts
function strategyHash(value) {
	return (0, node_crypto.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
}
//#endregion
//#region packages/build/artifact.ts
/** Validate a data-only envelope; never import, eval, launch or activate its content. */
function inspectRulePackage(input) {
	if (!input || typeof input !== "object") throw Error("Invalid artifact envelope.");
	const envelope = input, artifact = envelope.artifact;
	if (!artifact || artifact.format !== "heartflow-rule-package" || artifact.version !== 1 || artifact.engine !== "heartflow-typed-rules-v1" || !artifact.strategy) throw Error("Unsupported artifact schema/engine.");
	const keys = (value, expected) => {
		if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected.sort())) throw Error("Unsupported artifact fields.");
	};
	if (Buffer.byteLength(JSON.stringify(input), "utf8") > 128e3) throw Error("Artifact exceeds inspection size limit.");
	keys(envelope, ["hash", "artifact"]);
	keys(artifact, [
		"format",
		"version",
		"engine",
		"strategy",
		"capabilities",
		"dependencies",
		"rules",
		"validation"
	]);
	keys(artifact.strategy, [
		"id",
		"revisionId",
		"revision",
		"specHash",
		"spec"
	]);
	if (typeof envelope.hash !== "string" || !/^[a-f0-9]{64}$/.test(envelope.hash) || strategyHash(artifact) !== envelope.hash) throw Error("Artifact integrity hash mismatch.");
	if (JSON.stringify(artifact.capabilities) !== JSON.stringify(["typed-market-observations", "paper-intents"]) || JSON.stringify(artifact.dependencies) !== "[]" || JSON.stringify(artifact.validation) !== JSON.stringify({
		kind: "static-schema-only",
		runtimeVerified: false,
		activationAuthorized: false
	})) throw Error("Unsupported capabilities or validation claims.");
	const spec = parseStrategySave({
		profileId: "artifact-inspection",
		requestId: artifact.strategy.revisionId,
		strategyId: artifact.strategy.id,
		baseRevision: artifact.strategy.revision,
		spec: artifact.strategy.spec,
		reviewed: true
	}).spec;
	if (strategyIssues(spec).length || strategyHash(spec) !== artifact.strategy.specHash || strategyHash(spec) !== strategyHash(artifact.strategy.spec) || JSON.stringify(readableStrategy(spec)) !== JSON.stringify(artifact.rules)) throw Error("Artifact rules/specification are inconsistent.");
	return structuredClone(envelope);
}
//#endregion
//#region packages/build/companion.ts
/** Read only an explicitly selected file. Bound allocation even if the file grows after stat. */
async function readRulePackage(path) {
	if (typeof path !== "string" || !path.trim() || path.length > 4096 || /[\u0000-\u001f]/.test(path) || /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(path)) throw Error("Choose a local JSON file path.");
	const file = await (0, node_fs_promises.open)(path, "r");
	try {
		const info = await file.stat();
		if (!info.isFile() || info.size > 128e3) throw Error("Choose a regular rule package file no larger than 128 KB.");
		const buffer = Buffer.alloc(128001);
		let length = 0;
		while (length < buffer.length) {
			const read = await file.read(buffer, length, buffer.length - length, null);
			if (!read.bytesRead) break;
			length += read.bytesRead;
		}
		if (length > 128e3) throw Error("Rule package exceeds 128 KB.");
		return inspectRulePackage(JSON.parse(buffer.subarray(0, length).toString("utf8")));
	} finally {
		await file.close();
	}
}
async function inspectRuleFile(path) {
	const result = await readRulePackage(path), s = result.artifact.strategy;
	return {
		hash: result.hash,
		engine: result.artifact.engine,
		name: s.spec.name,
		strategyId: s.id,
		revision: s.revision,
		revisionId: s.revisionId,
		rules: result.artifact.rules,
		runtimeVerified: false,
		activationAuthorized: false
	};
}
function inspectionLines(value) {
	return [
		"LOCAL RULE PACKAGE · INSPECTION ONLY",
		`${value.name} · revision ${value.revision}`,
		`Strategy: ${value.strategyId}`,
		`Revision: ${value.revisionId}`,
		`Engine: ${value.engine}`,
		`SHA-256: ${value.hash}`,
		"Static structure/integrity checked; runtime behavior is unverified.",
		"No activation, model sharing or execution permission.",
		...value.rules
	];
}
//#endregion
exports.inspectRuleFile = inspectRuleFile;
exports.inspectionLines = inspectionLines;
exports.readRulePackage = readRulePackage;
