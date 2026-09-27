package com.itsupport.app.ui.login

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.itsupport.app.databinding.ActivityLoginBinding
import com.itsupport.app.ui.main.MainActivity
import com.itsupport.app.ui.viewmodel.LoginViewModel

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private val viewModel: LoginViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check if already logged in
        if (viewModel.sessionManager.isLoggedIn()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val currentServerUrl = viewModel.sessionManager.getServerUrl()
        binding.etServerUrl.setText(currentServerUrl)

        setupListeners()
        observeViewModel()
    }

    private fun setupListeners() {
        binding.btnLogin.setOnClickListener {
            val serverUrl = binding.etServerUrl.text.toString().trim()
            val username = binding.etUsername.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()

            if (serverUrl.isBlank() || username.isBlank() || password.isBlank()) {
                Toast.makeText(this, "Harap isi semua kolom login", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            viewModel.login(serverUrl, username, password)
        }
    }

    private fun observeViewModel() {
        viewModel.loading.observe(this) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            binding.btnLogin.isEnabled = !isLoading
        }

        viewModel.loginResult.observe(this) { result ->
            result.onSuccess { response ->
                if (response.ok) {
                    Toast.makeText(this, "Login berhasil!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this, MainActivity::class.java))
                    finish()
                } else {
                    val msg = response.error ?: response.message ?: "Login gagal"
                    Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                }
            }.onFailure { error ->
                Toast.makeText(this, "Gagal terhubung ke server: ${error.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}
