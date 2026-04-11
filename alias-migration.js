import fs from 'fs';
import path from 'path';

// Define the absolute mapping rules
const aliasMap = [
  // Legacy ui references
  { regex: /from ['"](\.\.\/)*components\/ui\/([^'"]+)['"]/g, replace: "from '@/components/ui/$2'" },
  { regex: /from ['"]\.\/ui\/([^'"]+)['"]/g, replace: "from '@/components/ui/$1'" },
  { regex: /from ['"]\.\.\/ui\/([^'"]+)['"]/g, replace: "from '@/components/ui/$1'" },
  { regex: /from ['"]\.\.\/\.\.\/components\/ui\/([^'"]+)['"]/g, replace: "from '@/components/ui/$1'" },

  // Library / Context references
  { regex: /from ['"](\.\.\/)+lib\/([^'"]+)['"]/g, replace: "from '@/lib/$2'" },
  { regex: /from ['"](\.\.\/)+contexts\/([^'"]+)['"]/g, replace: "from '@/contexts/$2'" },
  
  // Specific cross-domain components
  { regex: /from ['"]\.\/TechStackSelector['"]/g, replace: "from '@/features/core/components/TechStackSelector'" },
  { regex: /from ['"]\.\.\/\.\.\/\.\.\/features\/core\/components\/TechStackSelector['"]/g, replace: "from '@/features/core/components/TechStackSelector'" },
  { regex: /from ['"]\.\.\/components\/TechStackSelector['"]/g, replace: "from '@/features/core/components/TechStackSelector'" },
  { regex: /from ['"](\.\.\/)+TechStackSelector['"]/g, replace: "from '@/features/core/components/TechStackSelector'" },

  // Constants 
  { regex: /from ['"](\.\.\/)+features\/settings\/constants['"]/g, replace: "from '@/features/settings/constants'" },

  // Standalone Layout/Globals
  { regex: /from ['"]\.\/ErrorBoundary['"]/g, replace: "from '@/components/ErrorBoundary'" },
  { regex: /from ['"]\.\.\/components\/ErrorBoundary['"]/g, replace: "from '@/components/ErrorBoundary'" }
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      aliasMap.forEach(rule => {
        const newContent = content.replace(rule.regex, rule.replace);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated imports in: ${fullPath}`);
      }
    }
  }
}

processDir('./src');
console.log('Alias migration complete.');
