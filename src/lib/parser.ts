interface ParsedTest {
  substance: string;
  value: number;
  unit: string;
  minRange?: number;
  maxRange?: number;
}

interface ParsedGroup {
  name: string;
  tests: ParsedTest[];
}

export function parseBloodTestResults(text: string): ParsedGroup[] {
  console.log('Starting to parse blood test results');
  const groups: ParsedGroup[] = [];
  let currentGroup: ParsedGroup | null = null;

  // Split text into lines and process each line
  const lines = text.split('\n');
  console.log(`Found ${lines.length} lines to process`);

  for (const line of lines) {
    // Remove extra whitespace and skip empty lines
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if line is a group header (usually in caps or followed by specific patterns)
    if (isGroupHeader(trimmedLine)) {
      console.log(`Found group header: ${trimmedLine}`);
      if (currentGroup && currentGroup.tests.length > 0) {
        console.log(`Adding group "${currentGroup.name}" with ${currentGroup.tests.length} tests`);
        groups.push(currentGroup);
      }
      currentGroup = {
        name: trimmedLine,
        tests: []
      };
      continue;
    }

    // If we have a current group, try to parse test results
    if (currentGroup) {
      const test = parseTestLine(trimmedLine);
      if (test) {
        console.log(`Parsed test: ${test.substance} = ${test.value} ${test.unit}`);
        currentGroup.tests.push(test);
      }
    }
  }

  // Add the last group if it exists and has tests
  if (currentGroup && currentGroup.tests.length > 0) {
    console.log(`Adding final group "${currentGroup.name}" with ${currentGroup.tests.length} tests`);
    groups.push(currentGroup);
  }

  console.log(`Parsing completed. Found ${groups.length} groups`);
  return groups;
}

function isGroupHeader(line: string): boolean {
  // Group headers are typically in uppercase and/or contain specific keywords
  const headerPatterns = [
    /^[A-Z\s]{3,}$/,  // All caps, at least 3 characters
    /^(HEMATOLOGY|CHEMISTRY|LIPIDS|THYROID|VITAMINS|HORMONES|PROTEINS)/i,
    /^(Complete Blood Count|Metabolic Panel|Lipid Panel)/i
  ];

  return headerPatterns.some(pattern => pattern.test(line));
}

function parseTestLine(line: string): ParsedTest | null {
  // Common patterns for test results
  // Example: "Glucose    95    mg/dL    70-100"
  // Or: "Hemoglobin (Hb)    14.2    g/dL    13.5-17.5"
  
  const patterns = [
    // Pattern 1: Name Value Unit Range
    /^([^0-9]+?)\s+([\d.]+)\s+(\w+\/?\w*)\s*(?:[\(<]?([\d.]+)[-–]+([\d.]+)[\)>]?)?/,
    // Pattern 2: Name Value Unit (no range)
    /^([^0-9]+?)\s+([\d.]+)\s+(\w+\/?\w*)/
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const [, substance, value, unit, min, max] = match;
      
      // Validate required fields
      if (!substance?.trim() || !value || !unit?.trim()) {
        console.log('Skipping line due to missing required fields:', line);
        return null;
      }

      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        console.log('Skipping line due to invalid value:', line);
        return null;
      }

      const result: ParsedTest = {
        substance: substance.trim(),
        value: parsedValue,
        unit: unit.trim()
      };

      // Only add range if both min and max are valid numbers
      if (min && max) {
        const minValue = parseFloat(min);
        const maxValue = parseFloat(max);
        if (!isNaN(minValue) && !isNaN(maxValue)) {
          result.minRange = minValue;
          result.maxRange = maxValue;
        }
      }

      return result;
    }
  }

  console.log('Line did not match any patterns:', line);
  return null;
}