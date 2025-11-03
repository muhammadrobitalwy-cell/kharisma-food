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
  // ================== ROLE HANDLING ==================
if (userRole !== 'admin') {
  document.getElementById('formSection').style.display = 'none';
}

// Tombol Download PDF hanya untuk admin
document.querySelectorAll(".btn-download").forEach(btn => {
  btn.style.display = (userRole === 'admin') ? 'inline-block' : 'none';
});

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

  // ================== ROLE HANDLING ==================
if (userRole !== 'admin') {
  document.getElementById('formSection').style.display = 'none';
}

// Tombol Download PDF hanya untuk admin
document.querySelectorAll(".btn-download").forEach(btn => {
  btn.style.display = (userRole === 'admin') ? 'inline-block' : 'none';
});

})();

// =================== LOAD DATA PERUSAHAAN ===================
async function loadPerusahaan() {
  const container = document.getElementById('tabPerusahaan');
  if (!container) return null;

  const { data, error } = await supabase.from('perusahaan').select('*');
  if (error || !data) return null;

  container.innerHTML = ''; // Kosongkan dulu
  data.forEach((p, index) => {
    const btn = document.createElement('button');
    btn.textContent = p.nama_perusahaan;
    btn.dataset.id = p.id;
    if (index === 0) btn.classList.add('active');
    btn.addEventListener('click', async () => {
  // Ubah tampilan tombol aktif
	  document.querySelectorAll('.tab-perusahaan button').forEach(b => b.classList.remove('active'));
	  btn.classList.add('active');

	  // Ganti ID perusahaan & tampilkan info
	  perusahaanId = p.id;
	  document.getElementById('namaPerusahaan').textContent = p.nama_perusahaan;
	  if (p.logo) document.getElementById('logoPerusahaan').src = p.logo;

	  // Refresh semua tampilan
	  await loadLaporan();

	  // Jika panel laporan terbuka, grafik juga diperbarui
	  if (typeof loadGrafikBulanan === "function") await loadGrafikBulanan();
	  if (typeof loadGrafikTahunan === "function") await loadGrafikTahunan();
	});

    container.appendChild(btn);
  });

  // Tampilkan perusahaan pertama secara default
  const pertama = data[0];
  if (pertama) {
    perusahaanId = pertama.id;
    document.getElementById('namaPerusahaan').textContent = pertama.nama_perusahaan;
    if (pertama.logo) document.getElementById('logoPerusahaan').src = pertama.logo;
    await loadLaporan();
    return pertama.id;
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
  const tanggal = document.getElementById('tanggal').value || new Date().toISOString().split('T')[0];
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
	  tanggal,
      keterangan,
    },
  ]);

  if (error) showAlert('Gagal menyimpan: ' + error.message, 'error');
	else {
	  // Reset form
	  document.getElementById('pemasukan').value = '';
	  document.getElementById('pengeluaran').value = '';
	  document.getElementById('keterangan').value = '';
	  
	  // 🔁 Set tanggal kembali ke hari ini
	  const today = new Date().toISOString().split('T')[0];
	  document.getElementById('tanggal').value = today;

	  // Refresh laporan & tampilkan pesan sukses
	  loadLaporan();
	  showAlert('✅ Data berhasil disimpan!', 'success');
	}

});

// =================== TAMPILKAN LAPORAN ===================
async function loadLaporan(selectedMonth = null) {
  if (!perusahaanId) return;

  // Tentukan range tanggal
  let startDate, endDate;
  if (selectedMonth) {
    const [year, month] = selectedMonth.split("-");
    startDate = `${year}-${month}-01`;
    endDate = new Date(year, month, 0).toISOString().split("T")[0]; // akhir bulan
  }

  // Query data dari supabase
  let query = supabase
    .from("keuangan_harian")
    .select("*")
    .eq("id_perusahaan", perusahaanId)
    .order("tanggal", { ascending: true });

  if (startDate && endDate) {
    query = query.gte("tanggal", startDate).lte("tanggal", endDate);
  }

  const { data, error } = await query;
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
      ${userRole === "admin" ? "<th>Aksi</th>" : ""}
    </tr>
  `;

  data.forEach((row, i) => {
    const debit = Number(row.debit || 0);
    const kredit = Number(row.kredit || 0);
    saldo += debit - kredit;
    const tglObj = new Date(row.tanggal);
    const tgl = `${String(tglObj.getDate()).padStart(2, "0")}/${String(
      tglObj.getMonth() + 1
    ).padStart(2, "0")}/${String(tglObj.getFullYear()).slice(-2)}`;

    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${tgl}</td>
        <td class="keterangan">${row.keterangan || ""}</td>
        <td class="angka">${debit ? formatRupiah(debit) : ""}</td>
        <td class="angka">${kredit ? formatRupiah(kredit) : ""}</td>
        <td class="angka">${formatRupiah(saldo)}</td>
        ${
          userRole === "admin"
            ? `<td>
                <button class="btnEdit" data-id="${row.id}">✏️</button>
                <button class="btnHapus" data-id="${row.id}">🗑️</button>
              </td>`
            : ""
        }
      </tr>
    `;
  });

  document.getElementById("tabelLaporan").innerHTML = html;
  document.getElementById("saldoSekarang").textContent = `Saldo Sekarang: ${formatRupiah(saldo)}`;

  // ==== Event edit / hapus ====
  if (userRole === "admin") {
    document.querySelectorAll(".btnHapus").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (confirm("Hapus transaksi ini?")) {
          const { error } = await supabase.from("keuangan_harian").delete().eq("id", id);
          if (error) showAlert("Gagal menghapus: " + error.message, "error");
          else {
            showAlert("✅ Data berhasil dihapus!", "success");
            loadLaporan(selectedMonth);
          }
        }
      });
    });

    document.querySelectorAll(".btnEdit").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const { data } = await supabase.from("keuangan_harian").select("*").eq("id", id).maybeSingle();
        if (!data) return;

        document.getElementById("editPemasukan").value = data.debit ? formatRupiah(data.debit) : "";
        document.getElementById("editPengeluaran").value = data.kredit ? formatRupiah(data.kredit) : "";
		document.getElementById("editTanggal").value = data.tanggal ? data.tanggal.split("T")[0] : "";
        document.getElementById("editKeterangan").value = data.keterangan || "";

        const modal = document.getElementById("editModal");
        modal.style.display = "flex";

        document.querySelector(".close").onclick = () => (modal.style.display = "none");
        window.onclick = (ev) => { if (ev.target === modal) modal.style.display = "none"; };

        document.getElementById("btnUpdate").onclick = async () => {
          const debitRaw = document.getElementById("editPemasukan").value.replace(/\D/g, "");
          const kreditRaw = document.getElementById("editPengeluaran").value.replace(/\D/g, "");
          const debit = parseFloat(debitRaw) || 0;
          const kredit = parseFloat(kreditRaw) || 0;
		  const tanggal = document.getElementById("editTanggal").value || new Date().toISOString().split("T")[0];
          const keterangan = document.getElementById("editKeterangan").value.trim();

          const { error } = await supabase.from("keuangan_harian").update({ debit, kredit, tanggal, keterangan }).eq("id", id);

          if (error) showAlert("Gagal update: " + error.message, "error");
          else {
            showAlert("✅ Data berhasil diperbarui!", "success");
            modal.style.display = "none";
            loadLaporan(selectedMonth);
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
   MODE SUARA OTOMATIS - ISI FORM & SIMPAN (DALAM SATU TOMBOL)
   ===================================================== */
const btnMicOtomatis = document.getElementById("btnMicOtomatis");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition && btnMicOtomatis) {
  recognition.lang = "id-ID";
  recognition.continuous = false;
  recognition.interimResults = false;

  // Fungsi reset tombol ke awal
  const resetButton = (delay = 3000) => {
    setTimeout(() => {
      btnMicOtomatis.innerHTML = "🎤 Isi Otomatis Suara";
      btnMicOtomatis.className = "";
      btnMicOtomatis.disabled = false;
    }, delay);
  };

  btnMicOtomatis.onclick = () => {
    btnMicOtomatis.disabled = true;
    btnMicOtomatis.innerHTML = "🎧 Mendengarkan...";
    btnMicOtomatis.classList.add("listening");
    recognition.start();
  };

  recognition.onresult = (event) => {
    const hasil = event.results[0][0].transcript.toLowerCase().trim();
    console.log("🎤 Hasil:", hasil);

    const stopCommands = ["salah", "ulangi", "sebentar", "kembali", "gagal"];
    if (stopCommands.some(cmd => hasil.includes(cmd))) {
      recognition.stop();
      btnMicOtomatis.innerHTML = "⛔ Dihentikan";
      btnMicOtomatis.classList.add("status-error");
      resetButton();
      showAlert("🎙️ Perekaman dihentikan.", "error");
      return;
    }

    const matchDebit = hasil.match(/debit\s+(?:sebanyak|sebesar|senilai|sejumlah)?\s*([\w\s.,-]+)/);
    const matchKredit = hasil.match(/kredit\s+(?:sebanyak|sebesar|senilai|sejumlah)?\s*([\w\s.,-]+)/);
    const matchKeterangan = hasil.match(/keterangan\s+(.+)/);
    const isSimpan = hasil.includes("simpan");

    // Debit
    if (matchDebit) {
      const debitTeks = matchDebit[1].replace(/rupiah|rp|,|\./g, '').trim();
      const debitNum = ubahTeksKeAngka(debitTeks);
      document.getElementById("pemasukan").value = String(debitNum);
      document.getElementById("pemasukan").dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Kredit
    if (matchKredit) {
      const kreditTeks = matchKredit[1].replace(/rupiah|rp|,|\./g, '').trim();
      const kreditNum = ubahTeksKeAngka(kreditTeks);
      document.getElementById("pengeluaran").value = String(kreditNum);
      document.getElementById("pengeluaran").dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Keterangan
    if (matchKeterangan) {
      const ket = matchKeterangan[1].replace(/\bsimpan\b.*/, "").trim();
      document.getElementById("keterangan").value = ket;
    }

    // Jika langsung simpan
    if (isSimpan) {
      btnMicOtomatis.innerHTML = "⏳ Mengecek & Simpan...";
      btnMicOtomatis.classList.add("status-proses");
      setTimeout(() => {
        const ketValue = document.getElementById("keterangan").value.trim();
        if (ketValue === "") {
          btnMicOtomatis.innerHTML = "⚠️ Lengkapi Keterangan!";
          btnMicOtomatis.classList.add("status-error");
          resetButton();
          showAlert("❗ Keterangan wajib diisi sebelum simpan.", "error");
          return;
        }
        btnMicOtomatis.innerHTML = "✅ Disimpan Otomatis";
        btnMicOtomatis.classList.add("status-simpan");
        document.getElementById("btnSimpan").click();
        resetButton(2500);
      }, 800);
    } else {
      btnMicOtomatis.innerHTML = "🟤 Selesai Mendengar";
      btnMicOtomatis.classList.add("status-selesai");
      showAlert("✅ Data suara terisi. Ucapkan 'simpan' untuk menyimpan.", "success");
      resetButton();
    }
  };

  recognition.onerror = (e) => {
    console.error("SpeechRecognition error:", e.error);
    let pesan = "❌ Kesalahan: " + e.error;
    if (e.error === "no-speech") pesan = "🔇 Tidak ada suara terdeteksi";
    if (e.error === "audio-capture") pesan = "🎧 Mic belum diizinkan";
    btnMicOtomatis.innerHTML = pesan;
    btnMicOtomatis.classList.add("status-error");
    resetButton();
  };

  recognition.onend = () => {
    if (!btnMicOtomatis.disabled) return;
    btnMicOtomatis.disabled = false;
    if (!btnMicOtomatis.className.includes("status-"))
      btnMicOtomatis.innerHTML = "🟤 Selesai Mendengar";
    resetButton();
  };
} else {
  console.warn("Speech Recognition tidak didukung browser ini.");
  if (btnMicOtomatis)
    btnMicOtomatis.innerHTML = "⚠️ Browser tidak mendukung suara";
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

// ==== FILTER LAPORAN PER BULAN ====
document.getElementById("filterTanggal")?.addEventListener("change", (e) => {
  const bulanDipilih = e.target.value; // format YYYY-MM
  loadLaporan(bulanDipilih);
});

// ============================================================
// 🗓️ SET DEFAULT BULAN & TAHUN SAAT HALAMAN DIMUAT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const defaultMonth = `${year}-${month}`;

  // 1️⃣ Filter utama di atas tabel
  const filterBulan = document.getElementById("filterTanggal");
  if (filterBulan) filterBulan.value = defaultMonth;

  // 2️⃣ Panel laporan lengkap - input bulan
  const laporanBulan = document.getElementById("laporanBulan");
  if (laporanBulan) laporanBulan.value = defaultMonth;

  // 3️⃣ Panel laporan lengkap - dropdown tahun
  const laporanTahun = document.getElementById("laporanTahun");
  if (laporanTahun) {
    laporanTahun.innerHTML = "";
    for (let i = year; i >= year - 5; i--) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      laporanTahun.appendChild(opt);
    }
    laporanTahun.value = year;
  }

  // 4️⃣ Otomatis muat data dan grafik awal
  if (typeof loadLaporan === "function") loadLaporan();           // Tabel utama
  if (typeof loadGrafikBulanan === "function") loadGrafikBulanan(); // Grafik bulanan
  if (typeof loadGrafikTahunan === "function") loadGrafikTahunan(); // Grafik tahunan
});

// ================== AUTO-UPDATE CHART ON MONTH/YEAR CHANGE ==================
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Pastikan elemen ada, lalu pasang listener
const laporanBulanEl = document.getElementById("laporanBulan");
const laporanTahunEl = document.getElementById("laporanTahun");

// Jika user ubah bulan pada panel Bulanan -> reload chart bulanan
if (laporanBulanEl) {
  laporanBulanEl.addEventListener("change", debounce(async (e) => {
    // set value (already set), lalu panggil ulang fungsi chart bulanan
    const bulan = e.target.value || new Date().toISOString().slice(0,7);
    document.getElementById("laporanBulan").value = bulan;
    if (typeof loadGrafikBulanan === "function") await loadGrafikBulanan();
  }, 250));
}

// Jika user ubah tahun pada panel Tahunan -> reload chart tahunan
if (laporanTahunEl) {
  laporanTahunEl.addEventListener("change", debounce(async (e) => {
    const tahun = e.target.value || new Date().getFullYear();
    document.getElementById("laporanTahun").value = tahun;
    if (typeof loadGrafikTahunan === "function") await loadGrafikTahunan();
  }, 250));
}

// Opsional: juga tangani input 'input' pada bulan (untuk browser yang memicu 'input' bukan 'change')
if (laporanBulanEl) {
  laporanBulanEl.addEventListener("input", debounce(async (e) => {
    if (typeof loadGrafikBulanan === "function") await loadGrafikBulanan();
  }, 300));
}


// ===================== PANEL BULANAN =====================
const panelLaporanBulanan = document.getElementById("panelLaporanBulanan");
const btnLaporanBulanan = document.getElementById("btnLaporanBulanan");
const closePanelBulanan = document.getElementById("closePanelBulanan");

// ===================== PANEL TAHUNAN =====================
const panelLaporanTahunan = document.getElementById("panelLaporanTahunan");
const btnLaporanTahunan = document.getElementById("btnLaporanTahunan");
const closePanelTahunan = document.getElementById("closePanelTahunan");

// === Fungsi bantu untuk menutup semua panel ===
function tutupSemuaPanel() {
  panelLaporanBulanan.classList.add("hidden");
  panelLaporanTahunan.classList.add("hidden");
}

// === Tombol BULANAN ===
btnLaporanBulanan.addEventListener("click", () => {
  const sedangTerbuka = !panelLaporanBulanan.classList.contains("hidden");

  // Tutup semua dulu
  tutupSemuaPanel();

  // Jika belum terbuka, buka yang bulanan
  if (!sedangTerbuka) {
    panelLaporanBulanan.classList.remove("hidden");
    loadGrafikBulanan();
  }
});

// Tombol tutup bulanan
closePanelBulanan.addEventListener("click", tutupSemuaPanel);

// === Tombol TAHUNAN ===
btnLaporanTahunan.addEventListener("click", () => {
  const sedangTerbuka = !panelLaporanTahunan.classList.contains("hidden");

  // Tutup semua dulu
  tutupSemuaPanel();

  // Jika belum terbuka, buka yang tahunan
  if (!sedangTerbuka) {
    panelLaporanTahunan.classList.remove("hidden");
    isiDropdownTahun();
    loadGrafikTahunan();
  }
});

// Tombol tutup tahunan
closePanelTahunan.addEventListener("click", tutupSemuaPanel);


// ===================== LAPORAN BULANAN =====================
let chartBulanan = null;
async function loadGrafikBulanan() {
  if (!perusahaanId) return;
  const bulan = document.getElementById("laporanBulan").value ||
    new Date().toISOString().slice(0,7);
  document.getElementById("laporanBulan").value = bulan;

  const [year, month] = bulan.split("-");
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data } = await supabase
    .from("keuangan_harian")
    .select("tanggal, debit, kredit")
    .eq("id_perusahaan", perusahaanId)
    .gte("tanggal", startDate)
    .lte("tanggal", endDate)
    .order("tanggal", { ascending: true });

  if (!data || !data.length) {
    const ctx = document.getElementById("chartBulanan").getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  let saldo = 0, totalDebit = 0, totalKredit = 0;
  const labels = [], saldoData = [], debitData = [], kreditData = [];

  data.forEach(row => {
    const debit = Number(row.debit || 0);
    const kredit = Number(row.kredit || 0);
    saldo += debit - kredit;
    totalDebit += debit;
    totalKredit += kredit;
    labels.push(new Date(row.tanggal).getDate());
    debitData.push(debit);
    kreditData.push(kredit);
    saldoData.push(saldo);
  });

  // Update ringkasan angka
  document.getElementById("bulanDebit").textContent = formatRupiah(totalDebit);
  document.getElementById("bulanKredit").textContent = formatRupiah(totalKredit);
  document.getElementById("bulanSaldo").textContent = formatRupiah(saldo);

  const ctx = document.getElementById("chartBulanan").getContext("2d");
  if (chartBulanan) chartBulanan.destroy();

  // === GRAFIK KOMBINASI ===
  chartBulanan = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Debit",
          data: debitData,
          backgroundColor: "rgba(70,190,100,0.6)"
        },
        {
          label: "Kredit",
          data: kreditData,
          backgroundColor: "rgba(255,99,132,0.6)"
        },
        {
          label: "Saldo",
          data: saldoData,
          type: "line",
          borderColor: "#d6a75b",
          backgroundColor: "rgba(214,167,91,0.2)",
          fill: true,
          tension: 0.3,
          yAxisID: "y"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Laporan Keuangan Bulan ${month}/${year}`
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Jumlah (Rp)" } },
        x: { title: { display: true, text: "Tanggal" } }
      }
    }
  });
}


// ===================== LAPORAN TAHUNAN =====================
let chartTahunan = null;
async function loadGrafikTahunan() {
  if (!perusahaanId) return;
  const tahun = document.getElementById("laporanTahun").value || new Date().getFullYear();

  const { data } = await supabase
    .from("keuangan_harian")
    .select("tanggal, debit, kredit")
    .eq("id_perusahaan", perusahaanId)
    .gte("tanggal", `${tahun}-01-01`)
    .lte("tanggal", `${tahun}-12-31`)
    .order("tanggal", { ascending: true });

  const bulanLabels = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const totalDebit = Array(12).fill(0);
  const totalKredit = Array(12).fill(0);
  let saldo = 0, saldoBulan = Array(12).fill(0);

  data.forEach(row => {
    const idx = new Date(row.tanggal).getMonth();
    const debit = Number(row.debit || 0);
    const kredit = Number(row.kredit || 0);
    totalDebit[idx] += debit;
    totalKredit[idx] += kredit;
  });

  for (let i = 0; i < 12; i++) {
    saldo += totalDebit[i] - totalKredit[i];
    saldoBulan[i] = saldo;
  }

  document.getElementById("tahunDebit").textContent = formatRupiah(totalDebit.reduce((a,b)=>a+b,0));
  document.getElementById("tahunKredit").textContent = formatRupiah(totalKredit.reduce((a,b)=>a+b,0));
  document.getElementById("tahunSaldo").textContent = formatRupiah(saldo);

  const ctx = document.getElementById("chartTahunan").getContext("2d");
  if (chartTahunan) chartTahunan.destroy();

  chartTahunan = new Chart(ctx, {
    type: "bar",
    data: { labels: bulanLabels, datasets: [
      { label: "Debit", data: totalDebit, backgroundColor: "rgba(70,190,100,0.6)" },
      { label: "Kredit", data: totalKredit, backgroundColor: "rgba(255,99,132,0.6)" },
      { label: "Saldo", data: saldoBulan, type: "line", borderColor: "#d6a75b", backgroundColor: "rgba(214,167,91,0.2)", fill: true }
    ]},
    options: { responsive: true, plugins: { title: { display: true, text: `Laporan Tahun ${tahun}` } } }
  });
}

// ===================== PDF DOWNLOAD DENGAN KOLOM SALDO & FORMAT PROFESIONAL =====================
async function downloadLaporanPDF(mode = "bulanan") {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const perusahaan = document.getElementById("namaPerusahaan")?.textContent || "-";
  const canvas = document.getElementById(mode === "bulanan" ? "chartBulanan" : "chartTahunan");
  const imgData = canvas.toDataURL("image/png");
  const debitText = document.getElementById(mode === "bulanan" ? "bulanDebit" : "tahunDebit").textContent;
  const kreditText = document.getElementById(mode === "bulanan" ? "bulanKredit" : "tahunKredit").textContent;
  const saldoText = document.getElementById(mode === "bulanan" ? "bulanSaldo" : "tahunSaldo").textContent;

  const periode =
    mode === "bulanan"
      ? document.getElementById("laporanBulan")?.value || new Date().toISOString().slice(0, 7)
      : document.getElementById("laporanTahun")?.value || new Date().getFullYear();

  // === Header ===
  pdf.setFontSize(14);
  pdf.text(`Laporan Keuangan ${mode === "bulanan" ? "Bulanan" : "Tahunan"}`, 10, 10);
  pdf.setFontSize(11);
  pdf.text(`Perusahaan: ${perusahaan}`, 10, 18);
  pdf.text(`Periode: ${periode}`, 10, 24);

  // === Grafik ===
  pdf.addImage(imgData, "PNG", 10, 30, 190, 90);

  // === Ringkasan ===
  pdf.setFontSize(11);
  let yPos = 125;
  pdf.text(`Total Debit :  ${debitText}`, 10, yPos);
  pdf.text(`Total Kredit: ${kreditText}`, 10, yPos + 7);
  pdf.text(`Saldo Akhir : ${saldoText}`, 10, yPos + 14);

  // === Ambil data dari database ===
  let { data } = await supabase
    .from("keuangan_harian")
    .select("tanggal, keterangan, debit, kredit")
    .eq("id_perusahaan", perusahaanId)
    .order("tanggal", { ascending: true });

  // Filter data hanya bulan/tahun aktif
  if (mode === "bulanan") {
    const [year, month] = periode.split("-");
    data = data.filter(row => {
      const d = new Date(row.tanggal);
      return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
    });
  } else {
    data = data.filter(row => new Date(row.tanggal).getFullYear() === parseInt(periode));
  }

  // === Tabel ===
  if (data && data.length) {
    yPos += 25;
    pdf.setFontSize(12);
    pdf.text("Rincian Transaksi", 10, yPos);

    // Hitung saldo berjalan
    let saldo = 0;
    const headers = [["No.", "Tanggal", "Keterangan", "Debit", "Kredit", "Saldo"]];
    const body = data.map((row, i) => {
      const debit = Number(row.debit || 0);
      const kredit = Number(row.kredit || 0);
      saldo += debit - kredit;

      return [
        i + 1,
        new Date(row.tanggal).toLocaleDateString("id-ID"),
        row.keterangan || "-",
        debit ? formatRupiah(debit) : "",
        kredit ? formatRupiah(kredit) : "",
        saldo ? formatRupiah(saldo) : "",
      ];
    });

    // Tambahkan baris total di akhir
    const totalDebit = data.reduce((a, b) => a + Number(b.debit || 0), 0);
    const totalKredit = data.reduce((a, b) => a + Number(b.kredit || 0), 0);
    const totalSaldo = totalDebit - totalKredit;
    body.push([
      "",
      "",
      "TOTAL",
      formatRupiah(totalDebit),
      formatRupiah(totalKredit),
      formatRupiah(totalSaldo),
    ]);

    // === Render tabel ===
    pdf.autoTable({
      startY: yPos + 5,
      head: headers,
      body: body,
      theme: "striped",
      headStyles: {
        fillColor: [214, 167, 91],
        halign: "center",
        valign: "middle",
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 }, // No.
        1: { halign: "center", cellWidth: 22 }, // Tanggal
        2: { halign: "left", cellWidth: 70 },   // Keterangan
        3: { halign: "right", cellWidth: 25 },  // Debit
        4: { halign: "right", cellWidth: 25 },  // Kredit
        5: { halign: "right", cellWidth: 30 },  // Saldo
      },
      didParseCell: (data) => {
        // Bold baris total
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 250, 235];
        }
      },
    });
  }

  // === Simpan PDF ===
  pdf.save(`Laporan_${mode}_${periode}.pdf`);
}


function isiDropdownTahun(){
  const sel=document.getElementById("laporanTahun");
  const now=new Date().getFullYear();
  sel.innerHTML="";
  for(let y=now;y>=now-5;y--){
    const opt=document.createElement("option");
    opt.value=y; opt.textContent=y; sel.appendChild(opt);
  }
  sel.value=now;
}

// ======================================================
// 🔄 PENGATUR TAB LAPORAN (Bulanan / Tahunan)
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const laporanBulanan = document.getElementById("laporanBulanan");
  const laporanTahunan = document.getElementById("laporanTahunan");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // ubah status tombol aktif
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      if (tab === "bulanan") {
        laporanBulanan.classList.remove("hidden");
        laporanTahunan.classList.add("hidden");
        if (typeof loadGrafikBulanan === "function") loadGrafikBulanan();
      } else {
        laporanBulanan.classList.add("hidden");
        laporanTahunan.classList.remove("hidden");
        if (typeof loadGrafikTahunan === "function") loadGrafikTahunan();
      }
    });
  });

  // tombol ❌ menutup panel laporan
  const closeBtn = document.getElementById("closePanel");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("panelLaporan").classList.add("hidden");
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const tglInput = document.getElementById("tanggal");
  if (tglInput) tglInput.value = new Date().toISOString().split("T")[0];
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
