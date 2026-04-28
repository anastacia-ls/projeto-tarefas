# ✦ Tarefas — Aplicação Web com Firebase

Mini-projeto desenvolvido no âmbito da unidade curricular de Desenvolvimento Web,
com o objetivo de criar uma aplicação funcional utilizando **Firebase Authentication** e **Firestore**.

---

## Descrição

**Tarefas** é uma aplicação web de gestão de tarefas pessoais (To-Do). Cada utilizador tem a sua
conta própria e vê apenas as suas tarefas. A aplicação permite criar, editar, filtrar e eliminar
tarefas, com suporte a categorias, prioridades, datas limite, anexos de ficheiros, partilha com
outros utilizadores e duas vistas: lista e calendário.

---

## Funcionalidades

### Obrigatórias
- Registo e login de utilizadores com email e palavra-passe (Firebase Authentication)
- Cada utilizador vê apenas os seus próprios dados
- CRUD completo: criar, listar, editar e apagar tarefas (Firestore)
- Interface organizada e responsiva

### Intermédias
- Tarefas ordenadas por data de criação (mais recentes primeiro)
- Validação de campos obrigatórios (título é obrigatório)
- Mensagens de feedback ao utilizador (toasts de sucesso, erro e info)
- Tradução de erros do Firebase para português

### Avançadas
- Dados isolados por utilizador (regras do Firestore com `uid`)
- Pesquisa em tempo real por título e descrição
- Filtros por estado (todas / por fazer / concluídas) e por categoria
- **8 categorias:** Trabalho 💼, Pessoal 🏠, Estudo 📚, Saúde 🏃, Finanças 💰, Família 👨‍👩‍👧, Viagem ✈️, Outro 🔖
- **Vista de calendário:** visualização mensal das tarefas com data limite, com navegação entre meses
- **Anexos de ficheiros:** qualquer tipo de ficheiro (até 500 KB) pode ser anexado a uma tarefa, guardado em Base64 no Firestore, com opção de descarregar e remover
- **Partilha de tarefas:** uma tarefa pode ser atribuída a outro utilizador pelo email — aparece na lista de ambos em tempo real, com indicador visual de tarefa partilhada
- Interface melhorada com cards, cores por categoria, indicador de tarefas vencidas e animações

---

## Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| HTML + CSS | Estrutura e estilo da interface |
| JavaScript (ES Modules) | Lógica da aplicação |
| Vite | Bundler e servidor de desenvolvimento |
| Firebase Authentication | Login e registo de utilizadores |
| Cloud Firestore | Base de dados em tempo real (inclui anexos em Base64) |
| Google Fonts (Syne + DM Sans) | Tipografia |

---

## Estrutura do projeto

```
projeto-tarefas/
├── index.html          # Página de login e registo
├── app.html            # Página principal da aplicação
├── src/
│   ├── firebase.js     # Inicialização do Firebase
│   ├── firestore.js    # Funções CRUD, listener duplo, anexos
│   ├── auth.js         # Autenticação (login, registo, logout)
│   ├── app.js          # Interface, filtros, calendário, modal, anexos
│   └── style.css       # Estilos globais
├── .gitignore
├── package.json
└── vite.config.js
```

---

## Como executar localmente

**Pré-requisitos:** Node.js instalado.

```bash
# 1. Clonar o repositório
git clone https://github.com/o-teu-username/projeto-tarefas.git
cd projeto-tarefas

# 2. Instalar dependências
npm install

# 3. Arrancar o servidor de desenvolvimento
npm run dev
```

Abre o browser em `http://localhost:5173`.

---

## Processo de desenvolvimento

O projeto foi desenvolvido de forma incremental, começando pela autenticação e evoluindo
progressivamente para as funcionalidades mais avançadas.

**Fase 1 — Autenticação**
Configuração do Firebase e implementação do login e registo com `signInWithEmailAndPassword`
e `createUserWithEmailAndPassword`. Redirecionamento automático entre páginas com `onAuthStateChanged`.

**Fase 2 — CRUD base**
Ligação ao Firestore com listener em tempo real (`onSnapshot`), permitindo que a interface
atualize automaticamente sem necessidade de recarregar a página. Implementação das operações
de criar (`addDoc`), atualizar (`updateDoc`) e eliminar (`deleteDoc`).

**Fase 3 — Filtros e pesquisa**
Implementação de filtros por estado e categoria aplicados localmente sobre a cache de tarefas,
sem chamadas extra ao Firestore. Pesquisa em tempo real por título e descrição.

**Fase 4 — Categorias alargadas**
Expansão de 4 para 8 categorias (Saúde, Finanças, Família, Viagem), com objeto `CATEGORIAS`
centralizado que serve tanto os cards da lista como o calendário, evitando repetição.

**Fase 5 — Vista de calendário**
Implementação de um calendário mensal gerado dinamicamente em JavaScript puro, sem bibliotecas
externas. As tarefas com data limite aparecem nas respetivas células, com indicador visual de
tarefas vencidas e navegação entre meses. Os filtros de estado e categoria aplicam-se também
à vista de calendário.

**Fase 6 — Anexos de ficheiros**
Implementação de upload de ficheiros usando a API `FileReader` para converter ficheiros em
Base64 e guardá-los diretamente no Firestore. Limite de 500 KB por ficheiro para respeitar
os limites do documento Firestore (máx. 1 MB). Os anexos aparecem nos cards como chips
clicáveis que descarregam o ficheiro original.

**Fase 7 — Partilha de tarefas**
Cada tarefa pode ser atribuída a outro utilizador pelo email. O `firestore.js` executa dois
listeners em paralelo — um para tarefas criadas pelo utilizador e outro para tarefas onde
`atribuidoAEmail` coincide com o email do utilizador — e junta os resultados sem duplicados.
As regras do Firestore foram atualizadas para permitir leitura ao utilizador atribuído, mantendo
a edição e eliminação exclusivas ao criador.

**Fase 8 — Organização do código**
Separação da lógica em módulos: `firebase.js` (inicialização), `firestore.js` (CRUD + listeners),
`auth.js` (autenticação) e `app.js` (interface). Utilização de ES Modules com Vite.

---

## Segurança e Firestore

As regras do Firestore garantem isolamento de dados entre utilizadores e suportam partilha controlada:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tarefas/{id} {
      // Leitura: o criador OU o utilizador a quem foi atribuída
      allow read: if request.auth != null &&
                  (request.auth.uid == resource.data.uid ||
                   request.auth.token.email == resource.data.atribuidoAEmail);

      // Criação: qualquer utilizador autenticado
      allow create: if request.auth != null;

      // Edição/eliminação: apenas o criador
      allow update, delete: if request.auth != null &&
                             request.auth.uid == resource.data.uid;
    }
  }
}
```

Os índices compostos criados no Firestore para suportar as queries:
- `uid` + `criadoEm` — tarefas próprias
- `atribuidoAEmail` + `criadoEm` — tarefas atribuídas

---

## Desafio final — Como escalar para 1000 utilizadores?

A arquitetura atual já suporta bem o crescimento, dado que o Firestore escala automaticamente.
No entanto, para 1000 utilizadores seria importante:

- **Regras do Firestore mais restritas** — validar também os campos na escrita (ex: impedir que um utilizador escreva com o `uid` de outro)
- **Índices compostos** — já implementados; para filtros adicionais seriam necessários mais índices
- **Paginação** — em vez de carregar todas as tarefas, usar `limit()` e `startAfter()` para carregar em páginas
- **Variáveis de ambiente** — mover as credenciais do Firebase para um ficheiro `.env` e nunca as expor no repositório público
- **Limite de tamanho dos anexos** — com muitos utilizadores, guardar ficheiros em Base64 no Firestore torna-se ineficiente; a solução ideal seria migrar para Firebase Storage

---

## Autor

Anastácia Sidorov  
Formador: António Gomes  
Instituto do Emprego e Formação Profissional (IEFP)
