## Architecture

```text
User
 ↓
Next.js UI (Chat + Real Response Cancellation)
 ↓
LLM Intent Extractor
 ↓
Validation
 ↓
Deterministic Inventory Mutation (REPLACE / ADD / REMOVE)
 ↓
Canonical Inventory
 ↓
Deterministic CBM Calculator
 ↓
Deterministic Storage Recommendation
 ↓
Verified Customer Response
```

## How to Run This Project

### Prerequisites

- **Node.js**: v18.18+ or v20+ recommended
- **npm**: v9+
- **LLM API Key**: Google Gemini API key (`GEMINI_API_KEY`);

### 1. Installation

From the repository root:

```bash
npm --prefix stow install
```

*(Alternatively: `cd stow && npm install`)*

### 2. Environment Configuration

Copy the example environment file in the `stow` directory:

```bash
# On Linux / macOS:
cp stow/.env.example stow/.env

# On Windows (PowerShell / cmd):
copy stow\.env.example stow\.env
```

Open `stow/.env` and set your API key:

```env
# Google Gemini 
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Running the Development Server

From the repository root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running Tests & Code Quality

Run the comprehensive test suite (all unit and end-to-end validation tests):

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

Run TypeScript typecheck:

```bash
npx tsc --project stow/tsconfig.json --noEmit
```
