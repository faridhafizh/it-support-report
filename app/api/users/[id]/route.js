import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin, hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { getUserById, updateUser, deleteUser } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/[id] - Memperbarui user atau reset password (Hanya Administrator)
 */
export async function PATCH(request, { params }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const targetUserId = Number(resolvedParams?.id || params?.id);

    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: "ID pengguna tidak valid." }, { status: 400 });
    }

    // Hanya Admin yang bisa mengedit user lain, atau user mengedit dirinya sendiri
    if (!isAdmin(currentUser) && currentUser.id !== targetUserId) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda tidak memiliki izin untuk mengedit pengguna ini." },
        { status: 403 }
      );
    }

    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const body = await request.json();
    const updates = {};

    if (body.name && String(body.name).trim().length >= 2) {
      updates.name = String(body.name).trim();
    }

    // Hanya Administrator yang dapat mengubah role
    if (body.role && isAdmin(currentUser)) {
      updates.role = String(body.role).trim();
    }

    // Reset password
    if (body.password) {
      if (String(body.password).length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.` },
          { status: 400 }
        );
      }
      updates.passwordHash = await hashPassword(body.password);
    }

    const updated = updateUser(targetUserId, updates);
    return NextResponse.json({
      ok: true,
      message: `Data pengguna ${updated.username} berhasil diperbarui.`,
      user: updated,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id] - Menghapus pengguna (Hanya Administrator)
 */
export async function DELETE(request, { params }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Administrator yang dapat menghapus pengguna." },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const targetUserId = Number(resolvedParams?.id || params?.id);

    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: "ID pengguna tidak valid." }, { status: 400 });
    }

    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        { error: "Anda tidak dapat menghapus akun Anda sendiri saat sedang login." },
        { status: 400 }
      );
    }

    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    deleteUser(targetUserId);

    return NextResponse.json({
      ok: true,
      message: `Pengguna ${targetUser.username} berhasil dihapus.`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
