
const http = require('http');// Para chamadas à API Ollama
const fs   = require('fs');// Para servir arquivos estáticos (HTML, CSS, JS)
const path = require('path'); // Para manipular caminhos de arquivos

const OLLAMA_MODEL = 'qwen2.5:1.5b';  // Nome do modelo Ollama a ser usado
const PORT         = 3000; // Porta onde o servidor vai rodar
const OLLAMA_HOST  = 'localhost';// Host onde o Ollama está rodando (geralmente localhost)
const OLLAMA_PORT  = 11434;// Porta padrão do Ollama

// ── Detecção de linguagem no servidor ──────────────────────────────────────
const PORTUGOL_TOKENS = [
  /\bescreva\s*\(/i, /\bfimse\b/i, /\bfimalgoritmo\b/i, /\bfimenquanto\b/i,
  /\bfimpara\b/i, /\bentao\b/i, /algoritmo\s*"/i, /(\w+)\s*<-\s*\S/,
  /\bleia\s*\(\w/i, /:\s*(inteiro|real|logico|caracter)\b/i,
  /\bfimfuncao\b/i, /\bfimprocedimento\b/i
];

function detectarLinguagem(codigo) {
  if (!codigo || !codigo.trim()) return null;
  var ptgScore = PORTUGOL_TOKENS.filter(function(p) { return p.test(codigo); }).length;
  if (ptgScore >= 2) return 'Portugol';
  if (/^\s*(def |class |import |from \S+ import|elif |lambda )/m.test(codigo) ||
      (/:\s*\n\s{2,}/.test(codigo) && /\bprint\s*\(/.test(codigo))) return 'Python';
  if (/\binterface\s+\w+/.test(codigo) ||
      /\btype\s+\w+\s*=/.test(codigo) ||
      (/:\s*(string|number|boolean|void|any|never|unknown)\b/.test(codigo) &&
       /\b(const|let|var|function|class)\b/.test(codigo))) return 'TypeScript';
  if (/[.#]?\w[\w-]*\s*\{[\s\S]*?:[\s\S]*?;/.test(codigo) ||
      /@(media|keyframes|import|charset)\b/.test(codigo)) return 'CSS';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|DROP TABLE|ALTER TABLE)\b/i.test(codigo)) return 'SQL';
  if (/<!DOCTYPE\s+html>/i.test(codigo) || /<html[\s>]/i.test(codigo)) return 'HTML';
  if (/\b(const|let|var|function|=>|console\.|module\.|require\()/.test(codigo) ||
      /function\s+\w+/.test(codigo) ||
      /\b(if|else|for|while|return|new|this|class|import|export)\b/.test(codigo)) return 'JavaScript';
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',// Para garantir que o HTML seja servido com UTF-8
  '.css':  'text/css',// Para arquivos CSS
  '.js':   'application/javascript',// Para arquivos JavaScript
};

// ── Prompts ───────────────────────────────────────────────────────────────────
// Cada função retorna um prompt específico para a tarefa desejada, baseado na origem do conteúdo fornecido pelo usuário. 
// Isso permite que o modelo Ollama gere respostas adequadas para cada tipo de solicitação (gerar código, explicação, pseudocódigo ou verificar sintaxe).
function promptCodigo(origem, conteudo) {
  const map = {
    explicacao: `O usuário escreveu uma explicação sobre o que um código deve fazer. Gere APENAS o código JavaScript correspondente, sem comentários, sem explicações, sem markdown. Apenas o código puro.\n\nExplicação: ${conteudo}`,
    portugues:  `O usuário escreveu pseudocódigo em português. Converta para código JavaScript real e funcional. Retorne APENAS o código, sem explicações.\n\nPseudocódigo: ${conteudo}`,
    sintaxe:    `O usuário mostrou um código com erros. Retorne APENAS o código corrigido, sem explicações.\n\nCódigo com erros: ${conteudo}`,
  };
  return map[origem];
}

function promptExplicacao(origem, conteudo) {
  const map = {
    codigo: `Explique este código em português brasileiro de forma clara e didática, como um professor para um iniciante.

REGRAS DE FORMATAÇÃO:
- Use ### seguido de texto para títulos/seções importantes (ex: ### O que o código faz)
- Use **texto em negrito** para destacar palavras-chave, nomes de variáveis e funções
- Use parágrafos curtos e fluidos entre os títulos
- Envolva nomes de código em backticks

Estrutura sugerida:
1. Um parágrafo curto dizendo o que o código faz
2. ### Como funciona — explicação passo a passo
3. Um parágrafo de conclusão ou dica

Código:\n\`\`\`\n${conteudo}\n\`\`\``,
    portugues: `O usuário escreveu pseudocódigo em português. Explique o que faz em português de forma clara.\n\nPseudocódigo: ${conteudo}`,
    sintaxe:   `O usuário mostrou um código com erros de sintaxe. Explique brevemente o que o código tenta fazer (ignore os erros).\n\nCódigo:\n\`\`\`\n${conteudo}\n\`\`\``,
    texto:     `O usuário descreveu em linguagem natural o que quer que um código faça. Explique de forma técnica em português.\n\nDescrição: ${conteudo}`,
  };
  return map[origem] || map.texto;
}

function promptPortugues(origem, conteudo) {
  const map = {
    codigo:    `Converta este código para pseudocódigo em português brasileiro. Escreva a lógica passo a passo em português, sem código real.\n\nCódigo:\n\`\`\`\n${conteudo}\n\`\`\``,
    explicacao:`O usuário escreveu uma explicação. Converta para pseudocódigo em português estruturado, passo a passo.\n\nExplicação: ${conteudo}`,
    sintaxe:   `O usuário mostrou um código com erros. Converta a intenção do código para pseudocódigo em português.\n\nCódigo:\n\`\`\`\n${conteudo}\n\`\`\``,
    texto:     `O usuário descreveu algo que quer fazer. Converta para pseudocódigo em português estruturado.\n\nDescrição: ${conteudo}`,
  };
  return map[origem] || map.texto;
}

function promptSintaxe(origem, conteudo) {
  const map = {
    codigo: `Você é um professor de programação revisando o código de um aluno.

PASSO 1 — Detecte todos os erros de sintaxe no código abaixo.
PASSO 2 — Para CADA erro encontrado, responda EXATAMENTE neste formato:

📍 Linha X — "<trecho exato do código com erro>"
Explicação: explique em português brasileiro, de forma didática e direta, o que está errado nessa linha. Como se fosse para um iniciante.
Correção: "<linha corrigida>"

PASSO 3 — No final, se encontrou erros, mostre:

✅ Código corrigido completo:
\`\`\`
coloque aqui o código inteiro corrigido
\`\`\`

Se NÃO houver erros, responda APENAS:
✅ Sem erros de sintaxe.

Regras:
- Seja didático na explicação: diga O QUE está errado e POR QUÊ (ex: "na linha 3, no console.log, está faltando a letra 'g' no final — o certo é 'console.log' e não 'console.lo'")
- Não use termos técnicos sem explicar
- Mostre o código original errado entre aspas
- Se o código nem compila, explique o erro raiz primeiro, depois liste os demais
- Seja conciso, mas claro

Código do aluno:
\`\`\`
${conteudo}
\`\`\``,

    explicacao: `O usuário descreveu uma funcionalidade em texto. Gere o código JavaScript correspondente e verifique sua própria sintaxe.\n\nDescrição: ${conteudo}`,

    portugues: `O usuário escreveu pseudocódigo em português. Converta para JavaScript e verifique a sintaxe. Mostre o código resultante e indique se há erros no formato didático.\n\nPseudocódigo: ${conteudo}`,

    texto: `O usuário descreveu algo. Gere o código JavaScript e verifique a sintaxe. Mostre o resultado.\n\nDescrição: ${conteudo}`,
  };
  return map[origem] || map.texto;
}

// ── Ollama ────────────────────────────────────────────────────────────────────
// Esta função é responsável por fazer a chamada à API do Ollama, enviando o prompt e recebendo a resposta. 
// Ela lida com erros de conexão e formatação da resposta, garantindo que o servidor possa responder adequadamente ao cliente.
function callOllama(prompt, callback) {
  const body = JSON.stringify({
    model:  OLLAMA_MODEL,
    stream: false,
    messages: [
      { role: 'system', content: 'Você é um especialista em programação. Responda sempre em português brasileiro. Seja direto e conciso. Quando a linguagem de programação for mencionada, leve-a em conta na sua resposta.' },
      { role: 'user',   content: prompt }
    ]
  });

  const options = {
    hostname: OLLAMA_HOST,
    port:     OLLAMA_PORT,
    path:     '/api/chat',
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',   // Especifica que o corpo da requisição é JSON
      'Content-Length': Buffer.byteLength(body),// Define o comprimento do corpo da requisição para que o servidor saiba quando a mensagem termina
    }
  };
//
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.error) return callback(null, 'Erro Ollama: ' + json.error);// Verifica se a resposta contém um erro e retorna uma mensagem de erro personalizada
        callback(json.message?.content || '', null);
      } catch (e) {
        callback(null, 'Erro ao processar resposta.');
      }
    });
  });
// Lida com erros de conexão, como quando o Ollama não está rodando ou não responde, e retorna uma mensagem de erro amigável para o cliente.
  req.on('error', () => callback(null, 'Ollama não está respondendo. Rode "ollama serve".'));
  req.write(body);
  req.end();
}

// ── Servidor ──────────────────────────────────────────────────────────────────
// O servidor HTTP é criado para lidar com requisições do cliente. Ele serve arquivos estáticos (HTML, CSS, JS) e também processa requisições POST para gerar código, explicações ou verificar sintaxe usando o modelo Ollama.
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/gerar') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let origem = '', conteudo = '';
      try {
        const parsed = JSON.parse(body);
        origem   = parsed.origem   || '';
        conteudo = parsed.conteudo || '';
      } catch (e) {}

      if (!conteudo.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Conteúdo vazio.' }));
      }

      // Detectar linguagem para adicionar contexto nos prompts
      var lingua = null;
      if (origem === 'codigo') {
        lingua = detectarLinguagem(conteudo);
      }

      const alvos = ['codigo', 'explicacao', 'portugues', 'sintaxe'].filter(a => a !== origem);

      const prompts = {};
      alvos.forEach(alvo => {
        var p = '';
        switch(alvo) {
          case 'codigo':    p = promptCodigo(origem, conteudo); break;
          case 'explicacao': p = promptExplicacao(origem, conteudo); break;
          case 'portugues': p = promptPortugues(origem, conteudo); break;
          case 'sintaxe':   p = promptSintaxe(origem, conteudo); break;
        }
        if (lingua) p = `[Linguagem detectada: ${lingua}]\n\n` + p;
        prompts[alvo] = p;
      });

      let concluidos = 0;
      const resultados = {};

      function verificar() {
        concluidos++;
        if (concluidos === alvos.length) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(resultados));
        }
      }

      alvos.forEach(alvo => {
        if (!prompts[alvo]) { resultados[alvo] = ''; verificar(); return; }
        callOllama(prompts[alvo], (texto, err) => {
          resultados[alvo] = err ? ('Erro: ' + err) : texto;
          verificar();
        });
      });
    });
    return;
  }

  // ── POST /gerar-explicacao-auto (CodeLens v4) ────────────────────────────
  if (req.method === 'POST' && req.url === '/gerar-explicacao-auto') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let codigo = '';
      try { codigo = JSON.parse(body).codigo || ''; } catch(e) {}

      if (!codigo.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Código vazio.' }));
      }

      const prompt = `Você é um professor de programação. Explique o código abaixo em português brasileiro de forma simples e direta, como se fosse para um iniciante. Use no máximo 3 frases curtas. Não use markdown. Apenas texto simples.\n\nCódigo:\n${codigo}`;

      callOllama(prompt, (texto, err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ explicacao: texto.trim() }));
      });
    });
    return;
  }

  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    const mime = MIME[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ⚡  Code Lens rodando!');
  console.log('  🤖  Modelo: ' + OLLAMA_MODEL);
  console.log('');
  console.log('  Acesse:  http://localhost:' + PORT);
  console.log('');
});
