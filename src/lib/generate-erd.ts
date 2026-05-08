import { spawnSync } from 'node:child_process'; // Used to run external commands like 'bunx drizzle-erd'
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * --- Configuration ---
 * Adjust these paths if your project structure differs.
 */
const SCHEMA_DIRECTORY = './src/server/db/schema'; // Directory containing your Drizzle schema .ts files
const MERGED_SCHEMA_FILE = './temp-merged-schema.ts'; // Temporary file for the merged schema
const OUTPUT_ERD_FILE = './docs/erd.svg'; // Output file name for the ERD (SVG format)

/**
 * Merges all TypeScript schema files from a specified directory into a single file.
 * It reliably extracts unique import statements (including multi-line ones)
 * and places them at the top of the merged file, followed by the content of all schema definitions.
 */
async function mergeAndGenerateErd() {
  console.log(`Starting schema merge process...`);
  const uniqueImports = new Set<string>(); // Stores all unique import statements found
  const allSchemaDefinitions: string[] = []; // Stores the actual schema and type definitions

  try {
    const files = fs.readdirSync(SCHEMA_DIRECTORY);

    if (files.length === 0) {
      console.warn(`No schema files found in ${SCHEMA_DIRECTORY}. Exiting.`);
      return;
    }

    for (const file of files) {
      if (file === 'index.ts') {
        continue;
      }
      if (file.endsWith('.ts')) {
        const filePath = path.join(SCHEMA_DIRECTORY, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // This comprehensive regex aims to capture all valid import statements.
        // It looks for:
        // 1. 'import' followed by anything, ending with a semicolon.
        // 2. 'import' followed by content, potentially spanning multiple lines (non-greedy .*? and \n),
        //    until it finds 'from' followed by a quoted string and an optional semicolon.
        // The 'gms' flags are crucial: 'g' for global match, 'm' for multi-line support for ^/$,
        // and 's' (dotAll) to make '.' match newlines, allowing for multi-line imports.
        const importRegex =
          /(^import\s+.*?;|^import\s+.*?\n[^;]*?from\s*['"`][^'"`]+['"`];?)/gms;
        let schemaContentWithoutImports = content;
        let match;

        // Iterate through the file content to find and extract all import statements
        while ((match = importRegex.exec(content)) !== null) {
          uniqueImports.add(match[0].trim()); // Add the full, trimmed import statement
          // Remove the matched import statement from the content,
          // so only schema definitions remain for the next step.
          schemaContentWithoutImports = schemaContentWithoutImports.replace(
            match[0],
            '',
          );
        }

        // After removing all imports, the remaining content is the schema definition.
        // Trim it to remove any leading/trailing whitespace that might be left.
        const trimmedSchemaContent = schemaContentWithoutImports.trim();
        if (trimmedSchemaContent.length > 0) {
          allSchemaDefinitions.push(trimmedSchemaContent);
        }
      }
    }

    // Construct the final merged content:
    // 1. All unique import statements, sorted alphabetically for deterministic output.
    // 2. A double newline for clear visual separation.
    // 3. All collected schema definition blocks, joined with double newlines for readability,
    //    filtering out any empty blocks that might have resulted from parsing.
    const finalContent =
      Array.from(uniqueImports).sort().join('\n') +
      '\n\n' +
      allSchemaDefinitions
        .filter((block) => block.trim().length > 0)
        .join('\n\n');

    // Write the consolidated content to the temporary file.
    fs.writeFileSync(MERGED_SCHEMA_FILE, finalContent);
    console.log(`Successfully merged schemas into ${MERGED_SCHEMA_FILE}`);

    // --- Run drizzle-erd ---
    console.log(`Running drizzle-erd to generate ERD...`);
    // Execute the 'drizzle-erd' command using 'bunx'.
    // 'stdio: inherit' ensures that any output or errors from 'drizzle-erd'
    // are directly displayed in your terminal.
    // 'shell: true' is often necessary for cross-platform compatibility,
    // especially on Windows, to correctly locate 'bunx' and other commands.
    const result = spawnSync(
      'bunx',
      ['drizzle-erd', '--in', MERGED_SCHEMA_FILE, '--out', OUTPUT_ERD_FILE],
      {
        stdio: 'inherit',
        shell: true,
      },
    );

    // Provide feedback based on the execution result of 'drizzle-erd'.
    if (result.error) {
      console.error(`Error executing drizzle-erd: ${result.error.message}`);
    } else if (result.status !== 0) {
      // If drizzle-erd exited with a non-zero status, it indicates an error.
      console.error(
        `drizzle-erd exited with code ${result.status}. Please check the output above for errors.`,
      );
    } else {
      console.log(
        `drizzle-erd finished successfully. ERD generated at ${OUTPUT_ERD_FILE}`,
      );
    }
  } catch (error) {
    // Catch any unexpected errors during the file reading or writing process.
    console.error(`An unexpected error occurred during the process:`, error);
  } finally {
    // --- Clean up ---
    // Crucially, always attempt to remove the temporary merged schema file
    // to keep your project directory clean, regardless of success or failure.
    if (fs.existsSync(MERGED_SCHEMA_FILE)) {
      fs.unlinkSync(MERGED_SCHEMA_FILE);
      console.log(`Cleaned up temporary file: ${MERGED_SCHEMA_FILE}`);
    }
  }
}

mergeAndGenerateErd();
