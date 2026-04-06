# Code Lens

Editor de código multilíngue com IA local via Ollama. Escreva código em qualquer linguagem e a IA gera explicação em português, pseudocódigo em Portugol e análise de sintaxe.

![Modelo Ollama](https://img.shields.io/badge/model-qwen2.5:1.5b-blue)
![Node](https://img.shields.io/badge/node-%3E%3D14-green)

## Funcionalidades

- **Detecção automática** de linguagem (JavaScript, Python, TypeScript, CSS, SQL, HTML, Portugol)
- **4 painéis totalmente editáveis** — copiar, colar e escrever em qualquer área
- **Explicação didática** gerada pela IA com títulos e destaques
- **Pseudocódigo em Portugol** — converte código real para algoritmo em português
- **Análise de sintaxe** com correções explicadas passo a passo
- **Console integrado** com execução real de JS e transpilação de Portugol
- **Modo tempo real** — gera resultados automaticamente enquanto digita
- **12 exemplos prontos** de código para estudar

## Pré-requisitos

- [Node.js](https://nodejs.org/) (v14 ou superior)
- [Ollama](https://ollama.com/) instalado e rodando com o modelo `qwen2.5:1.5b`

```bash
ollama pull qwen2.5:1.5b
```

## Como rodar

```bash
# 1. Instale as dependências (nenhuma necessária — http é built-in do Node)

# 2. Certifique-se que o Ollama está rodando
ollama serve

# 3. Inicie o servidor
node server.js

# 4. Abra no navegador
http://localhost:3000
```

## Como usar

| Ação | Como fazer |
|---|---|
| Escrever código | Digite ou cole no editor à esquerda |
| Gerar com IA | Preencha qualquer painel e clique **Gerar com IA** — os outros 3 painéis são preenchidos automaticamente |
| Executar código | Clique **Executar** no topo ou `Ctrl+Shift+Enter` |
| Modo tempo real | Clique **Tempo real** — o console e a explicação atualizam enquanto digita |
| Exemplos | Selecione um exemplo no dropdown do topo |
| Limpar tudo | Clique **Limpar** |

## Estrutura

```
.
├── server.js          # Servidor HTTP + prompts da IA
├── public/
│   └── index.html     # Frontend completo (HTML + CSS + JS)
└── .gitignore
```

Nenhuma dependência externa — usa apenas módulos built-in do Node (`http`, `fs`, `path`).

## Modelo

Usa **qwen2.5:1.5b** via Ollama. Para trocar o modelo, edite `OLLAMA_MODEL` em `server.js`:

```js
const OLLAMA_MODEL = 'seu-modelo-aqui';
```

Para mudar a porta, edite `PORT`:

```js
const PORT = 3000;
```

## Licença

MIT
