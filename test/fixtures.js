// Shared sample data for tests and benchmarks.
const SAMPLE = [
  'Config dump for prod:',
  'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCD',
  'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
  'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  'github: ghp_abcdefghijklmnopqrstuvwxyz0123456789AB',
  'db: postgres://admin:hunter2@db.internal:5432/app',
  'Contact: jane.doe@example.com, +33 6 12 34 56 78',
  'IBAN FR7630006000011234567890189 BIC BNPAFRPPXXX',
  'Card 4111111111111111 exp 12/29 cvv 123',
  'Server 192.168.10.42 mac 00:1A:2B:3C:4D:5E',
  'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc_def-ghi',
  'Path C:\\Users\\jane\\secrets.txt and /home/jane/.ssh/id_rsa',
  'Salary: 4500.00 €',
  'Passport: AB1234567',
  'https://hooks.slack.com/services/T000/B000/XXXXXXXX',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.'
].join('\n');

function bigText(targetLength) {
  let s = '';
  while (s.length < targetLength) s += SAMPLE + '\n';
  return s;
}

// The 1.0.0 implementation, kept as a reference for equivalence tests.
function legacyFilter(filters, text) {
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = text;
  let count = 0;
  for (const filter of filters.filter(f => f.enabled)) {
    let regex;
    try {
      regex = new RegExp(filter.useRegex ? filter.pattern : escapeRegex(filter.pattern), 'gi');
    } catch {
      continue;
    }
    const matches = result.match(regex);
    if (matches) {
      result = result.replace(regex, filter.replacement);
      count += matches.length;
    }
  }
  return { filtered: result, count };
}

module.exports = { SAMPLE, bigText, legacyFilter };
