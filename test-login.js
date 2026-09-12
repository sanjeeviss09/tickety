async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/v1/auth/first-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: 'AXX07',
        password: 'password123'
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
    if (data.rawError) {
      console.log('Raw Error:', data.rawError);
    }
  } catch (err) {
    console.log('Error message:', err.message);
  }
}

test();
