document.getElementById("age").innerText = getAge();

function getAge() {
  const now = new Date();
  const dayBirth = new Date(1993, 12, 28);
  const elapsed = now - dayBirth;
  return new Date(elapsed).getUTCFullYear() - 1970;
}
