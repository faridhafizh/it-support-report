package com.itsupport.app.ui.main

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.itsupport.app.R
import com.itsupport.app.data.model.Ticket
import com.itsupport.app.databinding.ActivityMainBinding
import com.itsupport.app.ui.login.LoginActivity
import com.itsupport.app.ui.viewmodel.DashboardViewModel

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: DashboardViewModel by viewModels()
    private lateinit var adapter: TicketAdapter

    private val filterOptions = listOf("Semua", "Open", "In Progress", "Menunggu Client", "Closed")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!viewModel.sessionManager.isLoggedIn()) {
            navigateToLogin()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.subtitle = "User: ${viewModel.sessionManager.getName()} (${viewModel.sessionManager.getRole()})"

        setupRecyclerView()
        setupFilters()
        setupSwipeRefresh()
        observeViewModel()

        binding.fabAddTicket.setOnClickListener {
            showAddTicketDialog()
        }

        viewModel.loadData()
    }

    private fun setupRecyclerView() {
        adapter = TicketAdapter(
            onStatusChange = { ticket, newStatus ->
                ticket.row?.let { viewModel.updateTicketStatus(it, newStatus) }
            },
            onEditClick = { ticket ->
                showEditTicketDialog(ticket)
            },
            onDeleteClick = { ticket ->
                showDeleteConfirmDialog(ticket)
            },
            isAdmin = viewModel.sessionManager.isAdmin()
        )
        binding.rvTickets.layoutManager = LinearLayoutManager(this)
        binding.rvTickets.adapter = adapter
    }

    private fun setupFilters() {
        // Status Filter Spinner
        val filterAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, filterOptions)
        filterAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerFilterStatus.adapter = filterAdapter

        binding.spinnerFilterStatus.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                viewModel.setFilterStatus(filterOptions[position])
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        // Search Input Watcher
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                viewModel.setSearchQuery(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadData()
        }
    }

    private fun observeViewModel() {
        viewModel.loading.observe(this) { isLoading ->
            binding.swipeRefresh.isRefreshing = isLoading
        }

        viewModel.filteredTickets.observe(this) { tickets ->
            adapter.submitList(tickets)
        }

        viewModel.summary.observe(this) { sum ->
            binding.tvTotalCount.text = sum.total.toString()
            binding.tvOpenCount.text = sum.byStatus.open.toString()
            binding.tvProgressCount.text = sum.byStatus.inProgress.toString()
            binding.tvClosedCount.text = sum.byStatus.closed.toString()
            binding.tvHighPriorityCount.text = sum.prioritasTinggi.toString()
        }

        viewModel.actionResult.observe(this) { result ->
            result.onSuccess {
                Toast.makeText(this, "Operasi berhasil disinkronkan ke Excel!", Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                Toast.makeText(this, "Error: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showAddTicketDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_create_ticket, null)

        val etClientName = dialogView.findViewById<EditText>(R.id.etClientName)
        val etDepartment = dialogView.findViewById<EditText>(R.id.etDepartment)
        val etDescription = dialogView.findViewById<EditText>(R.id.etDescription)
        val etPIC = dialogView.findViewById<EditText>(R.id.etPIC)
        val etSolution = dialogView.findViewById<EditText>(R.id.etSolution)
        val etNotes = dialogView.findViewById<EditText>(R.id.etNotes)

        val spinnerCategory = dialogView.findViewById<Spinner>(R.id.spinnerCategory)
        val spinnerPriority = dialogView.findViewById<Spinner>(R.id.spinnerPriority)
        val spinnerStatus = dialogView.findViewById<Spinner>(R.id.spinnerStatus)

        // Options Adapters
        val categories = viewModel.options.value?.kategori ?: listOf("Hardware", "Software", "Jaringan/Network", "Akun/Akses (Login)", "Printer/Peripheral", "Lainnya")
        val priorities = viewModel.options.value?.prioritas ?: listOf("Tinggi", "Sedang", "Rendah")
        val statuses = viewModel.options.value?.status ?: listOf("Open", "In Progress", "Menunggu Client", "Closed")

        spinnerCategory.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, categories)
        spinnerPriority.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, priorities)
        spinnerStatus.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, statuses)

        etPIC.setText(viewModel.sessionManager.getName())

        AlertDialog.Builder(this)
            .setTitle(R.string.add_ticket)
            .setView(dialogView)
            .setPositiveButton(R.string.save) { _, _ ->
                val client = etClientName.text.toString().trim()
                val dept = etDepartment.text.toString().trim()
                val desc = etDescription.text.toString().trim()
                val pic = etPIC.text.toString().trim()
                val solu = etSolution.text.toString().trim()
                val notes = etNotes.text.toString().trim()

                val kat = spinnerCategory.selectedItem?.toString() ?: "Software"
                val prio = spinnerPriority.selectedItem?.toString() ?: "Sedang"
                val stat = spinnerStatus.selectedItem?.toString() ?: "Open"

                if (client.isEmpty() || desc.isEmpty()) {
                    Toast.makeText(this, R.string.error_fill_fields, Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }

                viewModel.createTicket(client, dept, kat, prio, stat, desc, pic, solu, notes)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showEditTicketDialog(ticket: Ticket) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_edit_ticket, null)

        val tvClientInfo = dialogView.findViewById<TextView>(R.id.tvClientInfo)
        val spinnerStatus = dialogView.findViewById<Spinner>(R.id.spinnerStatus)
        val etPIC = dialogView.findViewById<EditText>(R.id.etPIC)
        val etSolution = dialogView.findViewById<EditText>(R.id.etSolution)
        val etNotes = dialogView.findViewById<EditText>(R.id.etNotes)

        tvClientInfo.text = "Client: ${ticket.namaClient} (${ticket.kategori})"
        etPIC.setText(ticket.pic ?: "")
        etSolution.setText(ticket.solusi ?: "")
        etNotes.setText(ticket.catatan ?: "")

        val statuses = viewModel.options.value?.status ?: listOf("Open", "In Progress", "Menunggu Client", "Closed")
        val spinnerAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, statuses)
        spinnerStatus.adapter = spinnerAdapter

        val currentIdx = statuses.indexOfFirst { it.equals(ticket.status, ignoreCase = true) }
        if (currentIdx >= 0) spinnerStatus.setSelection(currentIdx)

        AlertDialog.Builder(this)
            .setTitle(R.string.edit_ticket)
            .setView(dialogView)
            .setPositiveButton(R.string.save) { _, _ ->
                val stat = spinnerStatus.selectedItem?.toString() ?: "Open"
                val pic = etPIC.text.toString().trim()
                val solu = etSolution.text.toString().trim()
                val notes = etNotes.text.toString().trim()

                ticket.row?.let { r ->
                    viewModel.editTicket(r, stat, pic, solu, notes)
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showDeleteConfirmDialog(ticket: Ticket) {
        AlertDialog.Builder(this)
            .setTitle("Hapus Tiket #${ticket.no ?: ticket.row}")
            .setMessage("Apakah Anda yakin ingin menghapus tiket milik '${ticket.namaClient}'? Tindakan ini akan menghapus baris dari file Excel.")
            .setPositiveButton("Hapus") { _, _ ->
                ticket.row?.let { viewModel.deleteTicket(it) }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.menu_main, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_refresh -> {
                viewModel.loadData()
                true
            }
            R.id.action_logout -> {
                AlertDialog.Builder(this)
                    .setTitle(R.string.logout)
                    .setMessage(R.string.confirm_logout)
                    .setPositiveButton("Ya") { _, _ ->
                        viewModel.logout { navigateToLogin() }
                    }
                    .setNegativeButton("Batal", null)
                    .show()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun navigateToLogin() {
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
