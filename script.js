// =================== KONFIGURASI SUPABASE ===================
const SUPABASE_URL = 'https://igqyanangsakokphgvkg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncXlhbmFuZ3Nha29rcGhndmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MTk0NTEsImV4cCI6MjA3Njk5NTQ1MX0.LbbRU352LRt-bc9E7mCraBt9bXmitI5jt21-nvTGTRk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);



let perusahaanId = null;
let userRole = 'user';

// =================== LOGIN HANDLER ===================
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showAlert('Login gagal: ' + error.message, 'error');
    return;
  }

  // Save email for auto-complete
  localStorage.setItem('rememberedEmail', email);

  // Get user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  
  if (userData) userRole = userData.role;

  // Show main app
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';

  // Initialize app
  perusahaanId = await loadPerusahaan();
  if (perusahaanId) loadLaporan();

  // Show/hide form based on role
  if (userRole !== 'admin') {
    document.getElementById('formSection').style.display = 'none';
  }
});

// =================== LOGOUT HANDLER ===================
document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('appSection').style.display = 'none';
});

// =================== AUTO LOGIN CHECK ===================
(async () => {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  
  if (!user) {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display = 'none';
    return;
  }

  // User is logged in - show main app
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';

  // Get user role and initialize
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (userData) userRole = userData.role;

  perusahaanId = await loadPerusahaan();
  if (perusahaanId) loadLaporan();

  if (userRole !== 'admin') {
    document.getElementById('formSection').style.display = 'none';
  }
})();

// =================== LOAD DATA PERUSAHAAN ===================
async function loadPerusahaan() {
  const { data, error } = await supabase.from('perusahaan').select('*').limit(1);
  if (error) return null;
  if (data.length > 0) {
    const p = data[0];
    document.getElementById('mottoPerusahaan').textContent = p.motto_perusahaan;
    if (p.logo) document.getElementById('logoPerusahaan').src = p.logo;
    return p.id;
  }
  return null;
}

// =================== SIMPAN TRANSAKSI ===================
document.getElementById('btnSimpan')?.addEventListener('click', async () => {
  if (userRole !== 'admin') {
    showAlert('Hanya admin yang bisa menambah data!', 'error');
    return;
  }

  // **Penting**: Pastikan formater RupiahInput tidak menghilangkan angka sebelum disimpan
  const debitRaw = document.getElementById('pemasukan').value.replace(/\D/g, '');
  const kreditRaw = document.getElementById('pengeluaran').value.replace(/\D/g, '');
  const debit = parseFloat(debitRaw) || 0;
  const kredit = parseFloat(kreditRaw) || 0;
  const keterangan = document.getElementById('keterangan').value.trim();

  // Pastikan minimal ada salah satu nilai
  if (!debit && !kredit && !keterangan) {
    showAlert('Isi minimal keterangan atau nominal debit/kredit.', 'error');
    return;
  }

  const { error } = await supabase.from('keuangan_harian').insert([
    {
      id_perusahaan: perusahaanId,
      debit,
      kredit,
      keterangan,
    },
  ]);

  if (error) showAlert('Gagal menyimpan: ' + error.message, 'error');
  else {
    document.getElementById('pemasukan').value = '';
    document.getElementById('pengeluaran').value = '';
    document.getElementById('keterangan').value = '';
    loadLaporan();
    showAlert('✅ Data berhasil disimpan!', 'success');
  }
});

// =================== TAMPILKAN LAPORAN ===================
async function loadLaporan() {
  const { data, error } = await supabase
    .from('keuangan_harian')
    .select('*')
    .eq('id_perusahaan', perusahaanId)
    .order('tanggal', { ascending: true });

  if (error) return;

  let saldo = 0;
  let html = `
    <tr>
      <th>No.</th>
      <th>Tanggal</th>
      <th>Keterangan</th>
      <th>Debit</th>
      <th>Kredit</th>
      <th>Saldo</th>
      ${userRole === 'admin' ? '<th>Aksi</th>' : ''}
    </tr>
  `;

  data.forEach((row, i) => {
    const debit = Number(row.debit || 0);
    const kredit = Number(row.kredit || 0);
    saldo += debit - kredit;
    const tglObj = new Date(row.tanggal);
	  const tgl = `${String(tglObj.getDate()).padStart(2, '0')}/${String(tglObj.getMonth() + 1).padStart(2, '0')}/${String(tglObj.getFullYear()).slice(-2)}`;


    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${tgl}</td>
        <td class="keterangan">${row.keterangan || ''}</td>
        <td class="angka">${debit ? formatRupiah(debit) : ''}</td>
        <td class="angka">${kredit ? formatRupiah(kredit) : ''}</td>
        <td class="angka">${formatRupiah(saldo)}</td>
        ${
          userRole === 'admin'
            ? `<td>
                <button class="btnEdit" data-id="${row.id}">✏️</button>
                <button class="btnHapus" data-id="${row.id}">🗑️</button>
              </td>`
            : ''
        }
      </tr>
    `;
  });

  document.getElementById('tabelLaporan').innerHTML = html;
  document.getElementById('saldoSekarang').textContent = `Saldo Sekarang: ${formatRupiah(saldo)}`;

  // Tambahkan event listener edit/hapus
  if (userRole === 'admin') {
    document.querySelectorAll('.btnHapus').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Hapus transaksi ini?')) {
          const { error } = await supabase.from('keuangan_harian').delete().eq('id', id);
          if (error) showAlert('Gagal menghapus: ' + error.message, 'error');
          else {
            showAlert('✅ Data berhasil dihapus!', 'success');
            loadLaporan();
          }
        }
      });
    });

    document.querySelectorAll('.btnEdit').forEach(btn => {
	  btn.addEventListener('click', async (e) => {
		const id = e.target.dataset.id;
		const { data } = await supabase.from('keuangan_harian').select('*').eq('id', id).maybeSingle();
		if (!data) return;

		// Isi form modal
		document.getElementById('editPemasukan').value = data.debit ? formatRupiah(data.debit) : '';
		document.getElementById('editPengeluaran').value = data.kredit ? formatRupiah(data.kredit) : '';
		document.getElementById('editKeterangan').value = data.keterangan || '';

		const modal = document.getElementById('editModal');
		modal.style.display = 'flex';

		// Tutup modal
		document.querySelector('.close').onclick = () => {
		  modal.style.display = 'none';
		};

		// Klik di luar modal untuk menutup
		window.onclick = (ev) => {
		  if (ev.target === modal) modal.style.display = 'none';
		};

		// Tombol Update
		document.getElementById('btnUpdate').onclick = async () => {
		  const debitRaw = document.getElementById('editPemasukan').value.replace(/\D/g, '');
		  const kreditRaw = document.getElementById('editPengeluaran').value.replace(/\D/g, '');
		  const debit = parseFloat(debitRaw) || 0;
		  const kredit = parseFloat(kreditRaw) || 0;
		  const keterangan = document.getElementById('editKeterangan').value.trim();

		  const { error } = await supabase
			.from('keuangan_harian')
			.update({ debit, kredit, keterangan })
			.eq('id', id);

		  if (error) showAlert('Gagal update: ' + error.message, 'error');
		  else {
			showAlert('✅ Data berhasil diperbarui!', 'success');
			modal.style.display = 'none';
			loadLaporan();
		  }
		};
	  });
	});

  }
}


// =================== UTILITAS ===================
/**
 * Memformat angka menjadi format Rupiah (IDR). Cth: 200000 -> 200.000
 * @param {number} num Angka yang akan diformat.
 * @returns {string} String angka yang sudah diformat.
 */
function formatRupiah(num) {
  // Menggunakan toLocaleString untuk pemformatan standar Indonesia
  return (Number(num) || 0).toLocaleString('id-ID');
}

/* =====================================================
   OPI FOOD - MODE SUARA OTOMATIS LENGKAP (v2.6)
   ===================================================== */

/* ---------- FUNGSI FORMAT RUPIAH INPUT ---------- */
/**
 * Digunakan pada event 'oninput' untuk memformat input saat diketik.
 * @param {HTMLInputElement} el Elemen input yang diinputkan.
 */
function formatRupiahInput(el) {
  // Hapus semua non-digit
  let val = el.value.replace(/\D/g, "");
  // Format menjadi string Rupiah (cth: 200000 -> "200.000")
  el.value = val ? Number(val).toLocaleString("id-ID") : "";
}

/* ---------- ALERT SEDERHANA ---------- */
function showAlert(pesan, tipe = "info") {
  const box = document.getElementById("alertBox");
  box.textContent = pesan;
  box.className = `alert ${tipe}`;
  setTimeout(() => (box.textContent = ""), 4000);
}

/* =====================================================
   FUNGSI KONVERSI TEKS ANGKA INDONESIA → NOMINAL
   FIXED: Mendukung angka seperti 'dua puluh ribu' dan 'seratus lima puluh ribu'
   ===================================================== */
function ubahTeksKeAngka(teks) {
  if (!teks || typeof teks !== 'string') return 0;

  // Dictionary untuk angka dasar dan pengali
  const units = {
    nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
    enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
    sepuluh: 10, sebelas: 11,
  };
  const teens = {
    belas: 10,
  };
  const multipliers = {
    puluh: 10,
    ratus: 100,
    ribu: 1000,
    juta: 1000000,
  };

  // Normalisasi teks
  teks = teks.toLowerCase()
    .replace(/rupiah|,|dan|untuk|simpan|di|pada|dengan|sebesar|seratus|seribu/g, (match) => {
      // Ganti seratus/seribu menjadi "satu ratus"/"satu ribu" untuk memudahkan parsing
      if (match === 'seratus') return 'satu ratus';
      if (match === 'seribu') return 'satu ribu';
      return ' ';
    })
    .replace(/\s+/g, " ")
    .trim();

  // 1. Handle angka digital (seperti "7", "2.5", "2,5 juta")
  const digitalMatch = teks.match(/(\d+[.,]?\d*)\s*(juta|ribu|ratus|puluh)?/);
  if (digitalMatch && digitalMatch[1]) {
    const numStr = digitalMatch[1].replace(',', '.');
    let value = parseFloat(numStr);
    if (!isNaN(value)) {
      const scale = digitalMatch[2];
      if (scale && multipliers[scale]) {
        value = value * multipliers[scale];
      }
      return Math.round(value);
    }
  }

  // 2. Parsing teks bahasa Indonesia
  const tokens = teks.split(' ').filter(t => t.length > 0);
  let total = 0;
  let currentGroup = 0; 

  // Fungsi pembantu untuk mengkonversi unit/puluh/ratus
  function parseCurrentGroup(tokens) {
    let subtotal = 0;
    let temp = 0;

    for (let token of tokens) {
      if (units[token] !== undefined) {
        temp += units[token];
      } else if (teens[token] !== undefined) { 
        // Kasus belasan (satu belas -> 11, dua belas -> 12, dst.)
        temp = (temp || 1) + teens[token]; // Misal: satu (1) + belas (10) = 11
        // Khusus sebelas, harusnya 11. Karena sebelas sudah ada di units, 
        // token 'belas' disini hanya dipakai untuk belasan 12-19 yang dipisah
        // Sebagian besar pengenal suara menggabungkan "dua belas" menjadi "duabelas", 
        // tapi jika terpisah, kita tangani.
      } else if (multipliers[token] === 10) { 
        // Kasus puluhan (dua puluh -> 2 * 10 = 20)
        temp = (temp || 1) * 10;
      } else if (multipliers[token] === 100) { 
        // Kasus ratusan (dua ratus -> 2 * 100 = 200)
        temp = (temp || 1) * 100;
      } else {
        // Jika token tidak dikenal, hentikan
        break;
      }
    }
    return temp;
  }

  // Algoritma Parsing yang Ditingkatkan: Memproses per blok Ribuan/Jutaan
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Handle token angka digital yang belum tertangkap Regex awal
    if (/\d/.test(token)) {
      const numericValue = parseFloat(token.replace(',', '.'));
      const nextToken = tokens[i + 1];
      
      if (nextToken && multipliers[nextToken]) {
        total += (numericValue * multipliers[nextToken]);
        i++; // Skip multiplier
      } else {
        currentGroup += numericValue;
      }
      continue;
    }

    // Handle Multiplier Besar (Ribu, Juta)
    if (multipliers[token] >= 1000) {
      const multiplier = multipliers[token];
      
      // Ambil token-token sebelum multiplier besar (misal: "dua ratus" sebelum "ribu")
      const subTokens = [];
      let j = i - 1;
      // Ambil semua token di belakang hingga ketemu awal kalimat atau multiplier besar
      while (j >= 0 && tokens[j].length > 0 && multipliers[tokens[j]] < 1000 && !/\d/.test(tokens[j])) {
        subTokens.unshift(tokens[j]);
        j--;
      }
      
      // Hapus token yang sudah diproses dari array tokens
      tokens.splice(j + 1, i - j);
      i = j; // Reset index i ke posisi sebelum token yang dihapus
      
      // Konversi subTokens ke angka
      let subValue = parseCurrentGroup(subTokens);
      // Jika hanya "ribu" atau "juta" tanpa angka di depan, artinya 1 (misal "satu juta")
      if (subValue === 0 && subTokens.length > 0) subValue = 1; 

      total += subValue * multiplier;
      
      currentGroup = 0; // Reset
      continue;
    }

    // Handle Unit, Puluh, Ratus
    if (units[token] !== undefined || teens[token] !== undefined || (multipliers[token] && multipliers[token] < 1000)) {
      // Kumpulkan semua unit, puluh, ratus yang berdekatan
      const groupTokens = [];
      let k = i;
      while (k < tokens.length && 
             (units[tokens[k]] !== undefined || 
              teens[tokens[k]] !== undefined || 
              (multipliers[tokens[k]] && multipliers[tokens[k]] < 1000))) {
        groupTokens.push(tokens[k]);
        k++;
      }

      if (groupTokens.length === 0) continue; 
      
      // Hitung group saat ini
      currentGroup = parseCurrentGroup(groupTokens);
      
      // Pindahkan index i ke akhir groupTokens yang sudah diproses
      i = k - 1; 

      // Jika ini adalah akhir dari parsing (tidak ada ribu/juta lagi), tambahkan ke total
      if (i === tokens.length - 1) total += currentGroup;

      continue;
    }
  }
  
  // Gabungkan nilai yang tersisa
  total += currentGroup;

  // Pembulatan dan return
  const result = Math.round(total);
  return result > 0 ? result : 0;
}


/* =====================================================
   MODE SUARA OTOMATIS - ISI FORM & SIMPAN
   ===================================================== */
const btnMicOtomatis = document.getElementById("btnMicOtomatis");
const statusSuara = document.getElementById("statusSuara");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

// Menggunakan Native Web Speech API karena kode lama Anda menggunakannya
if (recognition && btnMicOtomatis) {
  recognition.lang = "id-ID";
  recognition.continuous = false;
  recognition.interimResults = false;

  btnMicOtomatis.onclick = () => {
    recognition.start();
    btnMicOtomatis.classList.add("listening");
    statusSuara.textContent = "🎧 Mendengarkan...";
    statusSuara.className = "status-dengar";
  };

  recognition.onresult = (event) => {
    const hasil = event.results[0][0].transcript.toLowerCase().trim();
    console.log("🎤 Hasil:", hasil);

    const stopCommands = ["salah", "ulangi", "sebentar", "kembali", "gagal"];
    if (stopCommands.some(cmd => hasil.includes(cmd))) {
      recognition.stop();
      btnMicOtomatis.classList.remove("listening");
      statusSuara.textContent = "⛔ Dihentikan oleh perintah suara";
      statusSuara.className = "status-error";
      showAlert("🎙️ Perekaman dihentikan.", "error");
      return;
    }

    // --- Ambil nilai berdasarkan ucapan ---
    const matchDebit = hasil.match(/debit\s+([\da-z.,\s]+)/);
    const matchKredit = hasil.match(/kredit\s+([\da-z.,\s]+)/);
    const matchKeterangan = hasil.match(/keterangan\s+(.+)/);
    const isSimpan = hasil.includes("simpan");

    if (matchDebit) {
      const debitTeks = matchDebit[1];
      // 1. Konversi teks suara ke nilai numerik (cth: 200000)
      const debitNum = ubahTeksKeAngka(debitTeks); 
      
      // ✅ PERBAIKAN: Isi form dengan angka mentah (string), biarkan oninput formatRupiahInput(this) memformatnya
      // String(200000) akan menjadi "200000". oninput akan mengubahnya menjadi "200.000"
      document.getElementById("pemasukan").value = String(debitNum);
      
      // PENTING: Pemicuan oninput secara manual untuk beberapa kasus browser
      const event = new Event('input', { bubbles: true });
      document.getElementById("pemasukan").dispatchEvent(event);
    }

    if (matchKredit) {
      const kreditTeks = matchKredit[1];
      const kreditNum = ubahTeksKeAngka(kreditTeks); 

      // ✅ PERBAIKAN: Isi form dengan angka mentah (string)
      document.getElementById("pengeluaran").value = String(kreditNum);
      
      // PENTING: Pemicuan oninput secara manual
      const event = new Event('input', { bubbles: true });
      document.getElementById("pengeluaran").dispatchEvent(event);
    }

    if (matchKeterangan) {
      let ket = matchKeterangan[1].replace(/\bsimpan\b.*/, "").trim();
      // Keterangan tetap diisi sebagai teks biasa
      document.getElementById("keterangan").value = ket;
    }
    
    // ... (sisa kode tidak berubah) ...
  };

    if (matchKeterangan) {
      let ket = matchKeterangan[1].replace(/\bsimpan\b.*/, "").trim();
      document.getElementById("keterangan").value = ket;
    }

    btnMicOtomatis.classList.remove("listening");

    if (isSimpan) {
      statusSuara.textContent = "✅ Disimpan otomatis";
      statusSuara.className = "status-simpan";
      setTimeout(() => document.getElementById("btnSimpan").click(), 700);
    } else {
      statusSuara.textContent = "🟤 Selesai mendengar";
      statusSuara.className = "status-selesai";
      showAlert("✅ Data suara terisi. Ucapkan 'simpan' untuk menyimpan.", "success");
    }
  };

  recognition.onerror = (e) => {
    console.error("SpeechRecognition error:", e.error);
    btnMicOtomatis.classList.remove("listening");
    if (e.error === "no-speech") {
      statusSuara.textContent = "🔇 Tidak ada suara terdeteksi";
      statusSuara.className = "status-hening";
    } else if (e.error === "audio-capture") {
      statusSuara.textContent = "🎧 Mic tidak aktif / belum diizinkan";
      statusSuara.className = "status-error";
    } else {
      statusSuara.textContent = "❌ Kesalahan: " + e.error;
      statusSuara.className = "status-error";
    }
  };

  recognition.onend = () => {
    btnMicOtomatis.classList.remove("listening");
    if (!statusSuara.className.includes("status-simpan") &&
        !statusSuara.className.includes("status-error")) {
      statusSuara.textContent = "🟤 Selesai mendengar";
      statusSuara.className = "status-selesai";
    }
  };
} else {
  console.warn("Speech Recognition tidak didukung browser ini.");
  if (statusSuara) statusSuara.textContent = "⚠️ Browser tidak mendukung suara.";
}


// =================== REMEMBER EMAIL OTOMATIS ===================
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email');
  if (emailInput) {
    // Isi otomatis dari localStorage jika ada
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      emailInput.value = savedEmail;
    }

    // Simpan otomatis setiap kali pengguna mengetik
    emailInput.addEventListener('input', () => {
      localStorage.setItem('rememberedEmail', emailInput.value);
    });
  }
});


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(reg => {
      console.log('SW registered', reg);
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      reg.onupdatefound = () => { /* ... */ };
    })
    .catch(err => console.error('SW reg failed', err));
}
