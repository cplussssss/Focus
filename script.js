

document.getElementById('yr').textContent = new Date().getFullYear();

function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const input = document.getElementById('password-input');
  const status = document.getElementById('modal-status');
  overlay.classList.add('open');
  status.className = 'modal-status';
  status.textContent = '';
  input.value = '';
  setTimeout(() => input.focus(), 250);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('password-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') submitPassword();
});

function submitPassword() {
  const input = document.getElementById('password-input');
  const status = document.getElementById('modal-status');
  const btn = document.getElementById('login-btn');

  const entered = input.value.trim();

  if (!entered) {
    status.className = 'modal-status error';
    status.textContent = '請輸入密碼。';
    input.focus();
    return;
  }



  if (entered === PASSWORD) {
    btn.disabled = true;
    status.className = 'modal-status loading';
    status.textContent = '驗證成功，正在跳轉…';
    setTimeout(() => {
      window.location.href = './toeicprep/';
    }, 600);
  } else {
    status.className = 'modal-status error';
    status.textContent = '密碼錯誤，請再試一次。';
    input.value = '';
    input.focus();
  }
}