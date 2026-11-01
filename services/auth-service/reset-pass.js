const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
    await prisma.user.update({ where: { uid: 1 }, data: { password: bcrypt.hashSync('Admin12345', 10) } });
    await prisma.user.update({ where: { uid: 2 }, data: { password: bcrypt.hashSync('Staff12345', 10) } });
    console.log('RESET MAT KHAU THANH CONG!');
}
reset();
