package com.itsupport.app.ui.main

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.itsupport.app.R
import com.itsupport.app.data.model.Ticket
import com.itsupport.app.databinding.ItemTicketBinding

class TicketAdapter(
    private val onStatusChange: (Ticket, String) -> Unit,
    private val onEditClick: (Ticket) -> Unit,
    private val onDeleteClick: (Ticket) -> Unit,
    private val isAdmin: Boolean
) : RecyclerView.Adapter<TicketAdapter.TicketViewHolder>() {

    private val tickets = mutableListOf<Ticket>()
    private val statusOptions = listOf("Open", "In Progress", "Menunggu Client", "Closed")

    fun submitList(newList: List<Ticket>) {
        tickets.clear()
        tickets.addAll(newList)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TicketViewHolder {
        val binding = ItemTicketBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return TicketViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TicketViewHolder, position: Int) {
        holder.bind(tickets[position])
    }

    override fun getItemCount(): Int = tickets.size

    inner class TicketViewHolder(private val binding: ItemTicketBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(ticket: Ticket) {
            val ctx = binding.root.context
            binding.tvTicketNo.text = "#${ticket.no ?: ticket.row ?: ""}"
            binding.tvClientName.text = ticket.namaClient
            binding.tvDepartment.text = ticket.departemen ?: "-"
            binding.tvCategory.text = ticket.kategori ?: "Lainnya"
            binding.tvDate.text = ticket.tanggalLapor ?: ""
            binding.tvDescription.text = ticket.deskripsi
            binding.tvPIC.text = "PIC: ${ticket.pic ?: "-"}"

            // Priority Badge Styling
            val priority = ticket.prioritas ?: "Sedang"
            binding.tvPriorityBadge.text = priority
            when (priority.lowercase()) {
                "tinggi" -> {
                    binding.tvPriorityBadge.setBackgroundColor(ContextCompat.getColor(ctx, R.color.priority_high_bg))
                    binding.tvPriorityBadge.setTextColor(ContextCompat.getColor(ctx, R.color.priority_high_text))
                }
                "sedang" -> {
                    binding.tvPriorityBadge.setBackgroundColor(ContextCompat.getColor(ctx, R.color.priority_medium_bg))
                    binding.tvPriorityBadge.setTextColor(ContextCompat.getColor(ctx, R.color.priority_medium_text))
                }
                else -> {
                    binding.tvPriorityBadge.setBackgroundColor(ContextCompat.getColor(ctx, R.color.priority_low_bg))
                    binding.tvPriorityBadge.setTextColor(ContextCompat.getColor(ctx, R.color.priority_low_text))
                }
            }

            // Solution Text
            if (!ticket.solusi.isNullOrBlank()) {
                binding.tvSolution.visibility = View.VISIBLE
                binding.tvSolution.text = "Solusi: ${ticket.solusi}"
            } else {
                binding.tvSolution.visibility = View.GONE
            }

            // Status Spinner Setup
            val spinnerAdapter = ArrayAdapter(ctx, android.R.layout.simple_spinner_item, statusOptions)
            spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            binding.spinnerStatus.adapter = spinnerAdapter

            val currentStatusIndex = statusOptions.indexOfFirst { it.equals(ticket.status, ignoreCase = true) }
            if (currentStatusIndex >= 0) {
                binding.spinnerStatus.setSelection(currentStatusIndex, false)
            }

            binding.spinnerStatus.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, pos: Int, id: Long) {
                    val selectedStatus = statusOptions[pos]
                    if (!selectedStatus.equals(ticket.status, ignoreCase = true)) {
                        onStatusChange(ticket, selectedStatus)
                    }
                }
                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }

            binding.btnEdit.setOnClickListener { onEditClick(ticket) }

            if (isAdmin) {
                binding.btnDelete.visibility = View.VISIBLE
                binding.btnDelete.setOnClickListener { onDeleteClick(ticket) }
            } else {
                binding.btnDelete.visibility = View.GONE
            }
        }
    }
}
