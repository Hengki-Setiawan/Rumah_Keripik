import fs from 'fs';
import path from 'path';

export interface SkillMetadata {
  name: string;
  description: string;
  toolsAllowed: string[];
  version: number;
  filePath: string;
}

export interface SkillFull extends SkillMetadata {
  instructions: string;
}

const SKILLS_DIR = path.join(process.cwd(), 'skills', 'ordering');

export function loadAllSkillMetadata(): SkillMetadata[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  const metadataList: SkillMetadata[] = [];

  for (const file of files) {
    const filePath = path.join(SKILLS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const yamlText = frontmatterMatch[1];
      const name = yamlText.match(/name:\s*(.*)/)?.[1]?.trim() || file.replace('.md', '');
      const descriptionMatch = yamlText.match(/description:\s*>\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/i) || yamlText.match(/description:\s*(.*)/);
      const description = descriptionMatch ? descriptionMatch[1].replace(/\n/g, ' ').trim() : '';

      metadataList.push({
        name,
        description,
        toolsAllowed: [],
        version: 1,
        filePath,
      });
    }
  }

  return metadataList;
}

export function loadFullSkill(filePath: string): SkillFull | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const instructions = frontmatterMatch ? content.slice(frontmatterMatch[0].length).trim() : content;

  const metadata = loadAllSkillMetadata().find((m) => m.filePath === filePath);
  if (!metadata) return null;

  return {
    ...metadata,
    instructions,
  };
}
