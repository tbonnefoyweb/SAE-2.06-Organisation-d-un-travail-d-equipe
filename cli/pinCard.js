const VERSION = "0.4.5";
const fs   = require("fs");
const path = require("path");
const { exec } = require("child_process");

const BASE_PATH         = path.join(__dirname, "sites");
const BOILERPLATE_PATH  = path.join(__dirname, "boilerplate.html");
const TEMPLATE_PATH     = path.join(__dirname, "template.svg");
const STYLE_SOURCE_PATH = path.join(__dirname, "styles.css");
const SITE_SCRIPT_PATH  = path.join(__dirname, "script.js");

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

const fmt = {
  err:     (s) => `${c.red}${c.bold}[ERREUR]${c.reset} ${c.red}${s}${c.reset}`,
  warn:    (s) => `${c.yellow}[AVERT.]${c.reset} ${s}`,
  ok:      (s) => `${c.green}[OK]${c.reset} ${s}`,
  info:    (s) => `${c.cyan}  ->${c.reset} ${s}`,
  section: (s) => `${c.bold}${s}${c.reset}`,
  cmd:     (s) => `${c.cyan}${s}${c.reset}`,
  file:    (s) => `${c.yellow}${s}${c.reset}`,
  fatal:   (s) => { console.error(fmt.err(s)); process.exit(1); },
};

const BRAILLE_SPINNER_FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

function createSpinner(label, frames = BRAILLE_SPINNER_FRAMES) {
  let i = 0, current = label;
  let id = setInterval(() =>
    process.stdout.write(`\r${c.cyan}${frames[i++ % frames.length]}${c.reset} ${current}`), 80);

  const clear = () => { clearInterval(id); id = null; };
  return {
    update: (msg) => { current = msg; },
    pause:  () => { clear(); process.stdout.write(`\r\x1b[2K`); },
    resume: (msg) => { if (msg) current = msg; if (!id) id = setInterval(() =>
      process.stdout.write(`\r${c.cyan}${frames[i++ % frames.length]}${c.reset} ${current}`), 80); },
    stop: (ok = true, msg = "") => {
      clear();
      const icon = ok ? `${c.green}✔${c.reset}` : `${c.red}✖${c.reset}`;
      process.stdout.write(`\r\x1b[2K${icon} ${msg || current}\n`);
    },
  };
}

function prompt(question) {
  const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

const confirm = async (q) =>
  (await prompt(`${c.yellow}?${c.reset} ${q} ${c.dim}(o/N)${c.reset} `)).toLowerCase() === "o";

async function confirmOIN(question) {
  let v;
  do {
    v = (await prompt(
      `${c.yellow}?${c.reset} ${question}\n  ${c.dim}[o = oui pour tous / i = choisir individuellement / n = annuler]${c.reset} `
    )).toLowerCase();
    if (!["o","i","n"].includes(v)) console.log(`  ${c.dim}Répondre par o, i ou n.${c.reset}`);
  } while (!["o","i","n"].includes(v));
  return v;
}

const args = process.argv.slice(2);

const FLAG_MAP = { help:["-h","--help"], upload:["-u","--upload"], create:["-c","--create"],
                   test:["-t","--test"], delete:["-d","--delete"], force:["-f","--force"], about:["-a","--about"]};

const flags = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([k, v]) => [k, v.some((f) => args.includes(f))])
);

const knownFlags = new Set(Object.values(FLAG_MAP).flat());
const COMMANDS   = Object.values(FLAG_MAP).flat();

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function suggestCommand(unknown) {
  const best = COMMANDS.reduce((acc, cmd) => {
    const d = levenshtein(unknown, cmd);
    return d < acc.dist ? { cmd, dist: d } : acc;
  }, { cmd: null, dist: Infinity });

  console.error(fmt.err(`Commande inconnue : ${c.yellow}${unknown}${c.reset}`));
  if (best.dist <= 3)
    console.error(`  ${c.dim}Vouliez-vous dire${c.reset} ${fmt.cmd(best.cmd)} ${c.dim}?${c.reset}`);
  console.error(`  Lancez ${fmt.cmd("node script.js --help")} pour voir les commandes disponibles.\n`);
}

const isEtudiantFolder = (name) => /^etudiant\d+$/i.test(name);
const extractNumber    = (name) => (name.match(/\d+/) || [])[0] ?? null;

function getEtudiantFolders() {
  let items;
  try { items = fs.readdirSync(BASE_PATH); }
  catch (e) { throw new Error(`Impossible de lire "${BASE_PATH}" : ${e.message}`); }
  return items
    .filter((name) => {
      try { return fs.statSync(path.join(BASE_PATH, name)).isDirectory() && isEtudiantFolder(name); }
      catch { return false; }
    })
    .sort((a, b) => Number(extractNumber(a)) - Number(extractNumber(b)));
}

function safeRead(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Fichier introuvable : ${filePath}`);
  try { return fs.readFileSync(filePath, "utf8"); }
  catch (e) { throw new Error(`Lecture impossible : ${filePath} — ${e.message}`); }
}

function safeWrite(filePath, content) {
  try { fs.writeFileSync(filePath, content, "utf8"); }
  catch (e) { throw new Error(`Écriture impossible : ${filePath} — ${e.message}`); }
}

function safeCopy(src, dest) {
  if (!fs.existsSync(src))        throw new Error(`Source introuvable : ${src}`);
  if (!fs.statSync(src).isFile()) throw new Error(`Pas un fichier : ${src}`);
  try { fs.copyFileSync(src, dest); }
  catch (e) { throw new Error(`Copie impossible : ${src} → ${dest} — ${e.message}`); }
}

function execAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true, ...options }, (error, stdout = "", stderr = "") => {
      if (error) {
        const details = stderr.trim() || stdout.trim() || error.message;
        reject(new Error(details));
        return;
      }
      resolve(stdout);
    });
  });
}

function applyTemplate(str, replacements) {
  return Object.entries(replacements).reduce((acc, [k, v]) => acc.split(k).join(v), str);
}

async function resolveConflicts(dossiers, fileNamesFn) {
  if (flags.force) return dossiers;

  const [conflict, clean] = dossiers.reduce(
    ([c, ok], dir) => {
      const hasConflict = fileNamesFn(extractNumber(dir))
        .some((f) => fs.existsSync(path.join(BASE_PATH, dir, f)));
      return hasConflict ? [[...c, dir], ok] : [c, [...ok, dir]];
    }, [[], []]
  );

  if (!conflict.length) return dossiers;

  console.log(fmt.warn(
    `Des fichiers générés existent déjà pour ${c.yellow}${conflict.length}${c.reset} étudiant(s) : ` +
    conflict.map((d) => `${c.yellow}etudiant${extractNumber(d)}${c.reset}`).join(", ")
  ));

  const choix = await confirmOIN("Écraser les fichiers existants ?");
  if (choix === "n") {
    conflict.forEach((d) => console.log(`  ${c.dim}etudiant${extractNumber(d)} ignoré.${c.reset}`));
    return clean;
  }
  if (choix === "o") return dossiers;

  // Mode individuel
  const chosen = [...clean];
  for (const dir of conflict) {
    const numero = extractNumber(dir);
    if (await confirm(`Écraser les fichiers de ${c.yellow}etudiant${numero}${c.reset} ?`))
      chosen.push(dir);
    else console.log(`  ${c.dim}etudiant${numero} ignoré.${c.reset}`);
  }
  return dossiers.filter((d) => chosen.includes(d));
}

function parseDataFile(dataPath) {
  if (!fs.existsSync(dataPath)) throw new Error(`Fichier data introuvable : ${dataPath}`);
  const lines = fs.readFileSync(dataPath, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 7)
    throw new Error(`${dataPath} : 7 lignes requises, ${lines.length} trouvée(s).`);
  const keys = ["nom","prenom","formation","annees","description1","description2","description3"];
  keys.forEach((key, i) => {
    if (!lines[i]) throw new Error(`Champ vide — ligne ${i+1} (${key}) dans ${dataPath}`);
  });
  return Object.fromEntries(keys.map((k, i) => [k, lines[i]]));
}

function generateIndexHtml(dir, template) {
  const numero = extractNumber(dir);
  const dossierPath = path.join(BASE_PATH, dir);
  const d = parseDataFile(path.join(dossierPath, `data${numero}.txt`));
  safeWrite(path.join(dossierPath, "index.html"), applyTemplate(template, {
    "{{NOM}}": d.nom, "{{PRENOM}}": d.prenom, "{{FORMATION}}": d.formation, "{{ANNEES}}": d.annees,
    "{{DESCRIPTION_1}}": d.description1, "{{DESCRIPTION_2}}": d.description2, "{{DESCRIPTION_3}}": d.description3,
  }));
  safeCopy(STYLE_SOURCE_PATH, path.join(dossierPath, "styles.css"));
  safeCopy(SITE_SCRIPT_PATH,  path.join(dossierPath, "script.js"));
}

function buildFinalUrl(ensUrl) {
  const id = ensUrl.replace(/^https?:\/\//, "").split(".")[0];
  return `https://${id}.pinme.dev`;
}

function parsePinmeList(output) {
  const map = new Map();
  // Découpe sur les séparateurs de blocs (lignes de tirets ou lignes vides multiples)
  for (const block of output.split(/(?:-{3,}|\n{2,})/)) {
    // Nom : ligne de type "N. etudiantX"
    const name = (block.match(/^\s*\d+\.\s*(\S+)/m) || [])[1];
    const ens  = (block.match(/ENS\s*URL\s*:\s*(https?:\/\/\S+)/i) || [])[1];
    if (name && ens && /^etudiant\d+$/i.test(name))
      map.set(name.trim(), buildFinalUrl(ens.trim()));
  }
  return map;
}

async function runPipeline() {
  const label = flags.test ? "test (upload simulé)" : "upload";
  console.log(fmt.section(`\nPipeline ${label}`));
  console.log(fmt.info(`Dossiers : ${c.yellow}${BASE_PATH}${c.reset}`));

  if (!fs.existsSync(BASE_PATH) || !fs.statSync(BASE_PATH).isDirectory())
    fmt.fatal(`Dossier introuvable : ${BASE_PATH}`);

  for (const [filePath, name] of [[BOILERPLATE_PATH,"boilerplate.html"],[STYLE_SOURCE_PATH,"styles.css"],[SITE_SCRIPT_PATH,"script.js"]])
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
      fmt.fatal(`Fichier requis introuvable : ${name}`);

  const template = safeRead(BOILERPLATE_PATH);
  const PLACEHOLDERS = ["{{NOM}}","{{PRENOM}}","{{FORMATION}}","{{ANNEES}}",
                        "{{DESCRIPTION_1}}","{{DESCRIPTION_2}}","{{DESCRIPTION_3}}"];
  const missing = PLACEHOLDERS.filter((p) => !template.includes(p));
  if (missing.length) fmt.fatal(`Placeholders manquants dans le template : ${missing.join(", ")}`);

  const dossiers = getEtudiantFolders();
  if (!dossiers.length) { console.log("\nAucun dossier etudiantX trouvé."); process.exit(0); }
  console.log(fmt.info(`${dossiers.length} étudiant(s) trouvé(s)\n`));

  if (!flags.test) {
    if (!await confirm(`${c.bold}Confirmer l'upload de ${dossiers.length} site(s) sur PinMe ?${c.reset}`))
      { console.log("Annulé."); process.exit(0); }
  }

  let QRCode;
  try { QRCode = require("qrcode"); }
  catch { fmt.fatal("Module 'qrcode' introuvable. Installez-le avec : npm install qrcode"); }

  const toProcess = await resolveConflicts(dossiers,
    (n) => ["index.html","styles.css","script.js",`lien${n}.txt`,`qrcode${n}.png`]);
  if (!toProcess.length) { console.log("\nAucun étudiant à traiter."); process.exit(0); }

  console.log();
  const errors      = [];
  const uploadErrors = [];
  const total        = toProcess.length;
  const spinner      = createSpinner("Préparation de l'upload…", BRAILLE_SPINNER_FRAMES);

  // ── 1. Générer les HTML + uploader (les URLs de preview sont ignorées) ──
  for (let i = 0; i < total; i++) {
    const dir    = toProcess[i];
    const numero = extractNumber(dir);
    spinner.update(`Upload étudiant ${numero}… (${i + 1}/${total})`);
    try {
      generateIndexHtml(dir, template);
      if (!flags.test)
        await execAsync(`pinme upload "${path.join(BASE_PATH, dir)}"`);
      spinner.stop(true, `Étudiant ${numero} uploadé (${i + 1}/${total})`);
      if (i < total - 1) spinner.resume();
    } catch (e) {
      spinner.stop(false, `Étudiant ${numero} — ${e.message}`);
      if (i < total - 1) spinner.resume();
      uploadErrors.push({ numero, message: e.message });
    }
  }

  // ── 2. Récupérer les URLs finales via pinme list (un seul appel) ──
  let urlMap = new Map();
  if (!flags.test) {
    spinner.resume("Récupération des URLs (pinme list)…");
    try {
      const listOut = await execAsync("pinme list");
      urlMap = parsePinmeList(listOut);
      if (!urlMap.size) throw new Error("Aucune ENS URL trouvée dans la sortie de `pinme list`.");
      spinner.stop(true, "URLs récupérées");
    } catch (e) {
      spinner.stop(false, `Échec pinme list — ${e.message}`);
      fmt.fatal(e.message);
    }
  }

  // ── 3. Générer les QR codes à partir des URLs reconstruites ──
  for (const dir of toProcess) {
    const numero      = extractNumber(dir);
    const dossierPath = path.join(BASE_PATH, dir);
    if (uploadErrors.some((e) => e.numero === numero)) continue;

    spinner.resume(`Génération QR code étudiant ${numero}…`);
    try {
      const url = flags.test
        ? `https://test-etudiant-${numero}.pinme.dev`
        : urlMap.get(dir);
      if (!url) throw new Error(`URL introuvable dans pinme list pour "${dir}".`);
      fs.writeFileSync(path.join(dossierPath, `lien${numero}.txt`), url, "utf8");
      await QRCode.toFile(path.join(dossierPath, `qrcode${numero}.png`), url);
      spinner.stop(true, `QR code étudiant ${numero} généré — ${url}`);
    } catch (e) {
      spinner.stop(false, `QR code étudiant ${numero} — ${e.message}`);
      errors.push({ numero, message: e.message });
    }
  }

  printSummary(total, [...uploadErrors, ...errors]);
}

function generateCarte(dossierPath, numero, template) {
  const dataPath   = path.join(dossierPath, `data${numero}.txt`);
  const qrPath     = path.join(dossierPath, `qrcode${numero}.png`);
  const outputPath = path.join(dossierPath, `carte${numero}.svg`);

  const logoPath = path.join(dossierPath, "logo.png");

  if (!fs.existsSync(dataPath))  throw new Error(`data${numero}.txt introuvable`);
  if (!fs.existsSync(qrPath))    throw new Error(`qrcode${numero}.png introuvable (lancez --upload d'abord)`);
  if (!fs.existsSync(logoPath))  throw new Error(`logo.png introuvable dans le dossier de l'étudiant ${numero}`);

  const lines = safeRead(dataPath).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) throw new Error(`data${numero}.txt : 4 lignes minimum requises`);

  const [nom, prenom, departement, annee] = lines;
  safeWrite(outputPath, applyTemplate(template, {
    "{{NOM}}": nom, "{{PRENOM}}": prenom, "{{DEPARTEMENT}}": departement, "{{ANNEE}}": annee,
    "QRCODE_PATH": `qrcode${numero}.png`,
    "LOGO_PATH":   "logo.png",
  }));
  return { nom, prenom };
}

async function runPipelineCarte() {
  console.log(fmt.section("\nPipeline cartes SVG"));
  console.log(fmt.info(`Template : ${c.yellow}${TEMPLATE_PATH}${c.reset}`));

  if (!fs.existsSync(TEMPLATE_PATH)) fmt.fatal(`Template introuvable : ${TEMPLATE_PATH}`);

  const spinner  = createSpinner("Chargement du template…");
  const template = safeRead(TEMPLATE_PATH);
  const dossiers = getEtudiantFolders();
  spinner.pause();

  if (!dossiers.length) { console.log("\nAucun dossier etudiantX trouvé."); process.exit(0); }
  console.log(fmt.info(`${dossiers.length} étudiant(s) trouvé(s)\n`));

  const toProcess = await resolveConflicts(dossiers, (n) => [`carte${n}.svg`]);
  if (!toProcess.length) { console.log("\nAucun étudiant à traiter."); process.exit(0); }

  console.log();
  spinner.resume("Traitement de l'étudiant…");
  const errors = [];

  for (const dir of toProcess) {
    const numero = extractNumber(dir);
    spinner.update(`Traitement de l'étudiant ${numero}…`);
    try { generateCarte(path.join(BASE_PATH, dir), numero, template); }
    catch (e) { errors.push({ numero, message: e.message }); }
  }

  spinner.stop(errors.length === 0, "Génération terminée");
  printSummary(toProcess.length, errors);
}

const GENERATED_FILES = (n) =>
  ["index.html","styles.css","script.js",`lien${n}.txt`,`qrcode${n}.png`,`carte${n}.svg`];

async function cleanFolders() {
  console.log(fmt.section("\nSuppression des fichiers générés"));
  if (!fs.existsSync(BASE_PATH)) fmt.fatal(`Dossier introuvable : ${BASE_PATH}`);

  const dossiers = getEtudiantFolders();
  if (!dossiers.length) { console.log("Aucun dossier etudiantX trouvé."); return; }

  const studentsWithFiles = dossiers.filter((dir) =>
    GENERATED_FILES(extractNumber(dir)).some((f) => fs.existsSync(path.join(BASE_PATH, dir, f)))
  );

  if (!studentsWithFiles.length) { console.log("Aucun fichier généré trouvé."); return; }

  let toDelete = studentsWithFiles;
  if (!flags.force) {
    console.log(fmt.warn(`Des fichiers générés vont être ${c.red}${c.bold}définitivement supprimés${c.reset} pour :`));
    studentsWithFiles.forEach((dir) => console.log(`  ${c.dim}étudiant ${extractNumber(dir)}${c.reset}`));
    console.log();
    const choix = await confirmOIN(`${c.red}${c.bold}Cette action est irréversible.${c.reset} Les fichiers générés ${c.red}et l'historique PinMe${c.reset} seront supprimés. Continuer ?`);
    if (choix === "n") { console.log("Annulé."); process.exit(0); }
    if (choix === "i") {
      toDelete = [];
      for (const dir of studentsWithFiles) {
        const numero = extractNumber(dir);
        if (await confirm(`Supprimer les fichiers de ${c.yellow}étudiant ${numero}${c.reset} ?`))
          toDelete.push(dir);
        else console.log(`  ${c.dim}étudiant ${numero} ignoré.${c.reset}`);
      }
      if (!toDelete.length) { console.log("\nAucun étudiant à supprimer."); process.exit(0); }
    }
  }

  console.log();
  const errors  = [];
  const spinner = createSpinner("Suppression en cours…");

  for (const dir of toDelete) {
    const numero = extractNumber(dir);
    spinner.update(`Nettoyage de l'étudiant ${numero}…`);
    try {
      GENERATED_FILES(numero)
        .map((f) => path.join(BASE_PATH, dir, f))
        .forEach((f) => { if (fs.existsSync(f)) fs.unlinkSync(f); });
    } catch (e) {
      errors.push({ numero, message: e.message });
    }
  }

  // Réinitialiser l'historique PinMe
  spinner.update("Réinitialisation de l'historique PinMe…");
  try {
    await execAsync("pinme list --clear");
  } catch {
    // pinme clear peut ne pas exister selon la version — on ignore silencieusement
  }

  spinner.stop(errors.length === 0, "Suppression terminée");
  printSummary(toDelete.length, errors);
}

function printSummary(total, errors) {
  const success = total - errors.length;
  console.log("\n" + "─".repeat(50));
  console.log(`${c.green}✔ Succès  :${c.reset} ${success}/${total}`);
  if (errors.length) {
    console.log(`${c.red}✖ Erreurs :${c.reset} ${errors.length}/${total}`);
    errors.forEach(({ numero, message }) =>
      console.log(`  ${c.red}•${c.reset} étudiant${numero} — ${message}`)
    );
    process.exit(1);
  }
  console.log("─".repeat(50));
}

function showHelp() {
  console.log(`
${fmt.section("Usage :")} node pinCard.js ${c.cyan}<commande>${c.reset}

${fmt.section("Commandes :")}

  ${fmt.cmd("--upload")}  ${c.dim}/ -u${c.reset}   Génère HTML, copie assets, uploade sur PinMe et crée les QR codes.
  ${fmt.cmd("--test")}    ${c.dim}/ -t${c.reset}   Identique à --upload mais sans upload réel (simulation).
  ${fmt.cmd("--create")}  ${c.dim}/ -c${c.reset}   Génère les cartes SVG à partir des fichiers dataX.txt.
  ${fmt.cmd("--delete")}  ${c.dim}/ -d${c.reset}   ${c.red}Supprime${c.reset} tous les fichiers générés et l'historique PinMe. ${c.red}${c.bold}Irréversible.${c.reset}
  ${fmt.cmd("--about")}   ${c.dim}/ -a${c.reset}   Affiche des informations sur le projet.
  ${fmt.cmd("--help")}    ${c.dim}/ -h${c.reset}   Affiche ce message.

${fmt.section("Options :")}

  ${fmt.cmd("--force")}   ${c.dim}/ -f${c.reset}   Écrase les fichiers existants sans demander confirmation.

${fmt.section("Structure attendue :")}
  ${fmt.file("boilerplate.html")}  Template HTML
  ${fmt.file("template.svg")}      Template carte
  ${fmt.file("styles.css")}        CSS à copier
  ${fmt.file("script.js")}         JS à copier
  ${fmt.file("sites/")}
  ├── ${fmt.file("etudiant1/")}
  │   └── data1.txt
  │   └── imageX.png   X correspond au numéro de la photo (1 à 3)
  │   └── logo.png     Logo du département de l'étudiant
  └── ${fmt.file("etudiant2/")}
      └── data2.txt
      └── imageX.png   X correspond au numéro de la photo (1 à 3)
      └── logo.png     Logo du département de l'étudiant
`);
}

function about() {
  const logoLines = [
  "    ____  _       ______               __   ",
  "   / __ \\(_)___  / ____/___  _________/ /   ",
  "  / /_/ / / __ \\/ /   / __ \\/ ___/ __  /    ",
  " / ____/ / / / / /___/ /_/ / /  / /_/ /     ",
  "/_/   /_/_/ /_/\\____/\\__,_/_/   \\__,_/      ",
];
const infoLines = [
  `  ${c.bold}pinCard${c.reset} v${VERSION}`,
  `  ${c.dim}Student Card Generator${c.reset}`,
  `   ${c.cyan}•${c.reset} QR Code generation`,
  `   ${c.cyan}•${c.reset} PinMe upload`,
  `   ${c.cyan}•${c.reset} SVG card rendering`,
];
logoLines.forEach((l, i) => {
  console.log(`${c.cyan}${l}${c.reset}  ${infoLines[i] ?? ""}`);
});
console.log();
}

async function main() {
  const unknown = args.find((a) => a.startsWith("-") && !knownFlags.has(a));
  if (unknown) { suggestCommand(unknown); process.exit(1); }

  if      (flags.help || args.length === 0) { showHelp(); process.exit(0); }
  else if (flags.about)                     { about(); process.exit(0); }
  else if (flags.delete)                    { await cleanFolders(); }
  else if (flags.upload || flags.test)      { await runPipeline(); }
  else if (flags.create)                    { await runPipelineCarte(); }
  else                                      { showHelp(); }
}

main().catch((e) => { console.error(fmt.err(e.message)); process.exit(1); });