async function check() {
  const url = 'http://localhost:5000/api/v1/employees'; // fetch employees
  const res = await fetch(url);
  const data = await res.json();
  console.log('Employees count:', data.data?.length);
}
check();
