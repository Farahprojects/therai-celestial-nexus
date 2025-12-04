// Test script to verify file upload security
// Run this in the browser console when on the document upload page

async function testFileUploadSecurity() {
  console.log('🛡️ Testing File Upload Security...\n');

  // Create a test file with malicious extension
  const maliciousFile = new File(
    ['This is harmless content but has a dangerous extension'],
    'test-malware.exe',
    { type: 'text/plain' }
  );

  // Create a test file with double extension
  const doubleExtFile = new File(
    ['This has double extensions which should be rejected'],
    'test.pdf.exe',
    { type: 'text/plain' }
  );

  // Create a valid file for comparison
  const validFile = new File(
    ['This is a valid text file'],
    'valid-document.txt',
    { type: 'text/plain' }
  );

  const testFiles = [
    { file: maliciousFile, expected: 'REJECTED', reason: 'Malicious .exe extension' },
    { file: doubleExtFile, expected: 'REJECTED', reason: 'Double extension bypass attempt' },
    { file: validFile, expected: 'ALLOWED', reason: 'Valid text file' }
  ];

  for (const test of testFiles) {
    console.log(`Testing: ${test.file.name}`);
    console.log(`Expected: ${test.expected} (${test.reason})`);

    try {
      // This will simulate what happens in uploadFileToStorage
      const validationResponse = await fetch('/functions/v1/validate-file-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')?.replace(/"/g, '')}`
        },
        body: JSON.stringify({
          bucket: 'folder-documents',
          fileName: test.file.name,
          fileType: test.file.type,
          fileSize: test.file.size
        })
      });

      const result = await validationResponse.json();

      if (validationResponse.ok && result.valid) {
        console.log(`✅ RESULT: ALLOWED - ${result.message}`);
      } else {
        console.log(`❌ RESULT: REJECTED - ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ RESULT: ERROR - ${error.message}`);
    }

    console.log('---\n');
  }

  console.log('🛡️ Security test complete!');
}

// Run the test
testFileUploadSecurity();
