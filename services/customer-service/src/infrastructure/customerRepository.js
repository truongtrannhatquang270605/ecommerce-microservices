const prisma = require('./prisma');

const include = { membership: true };

module.exports = {
    findByUid: (uid) => prisma.customer.findUnique({ where: { uid }, include }),

    findMembershipByMid: (mid) => prisma.memberShip.findUnique({ where: { mid } }),

    // hạng mặc định = hạng có score thấp nhất
    findDefaultMembership: () => prisma.memberShip.findFirst({ orderBy: { score: 'asc' } }),

    upsertMembership: (mname, score) =>
        prisma.memberShip.upsert({ where: { mname }, update: {}, create: { mname, score } }),

    // idempotent: tạo nếu chưa có; nếu hai bên tạo cùng lúc thì bỏ qua lỗi trùng khóa
    createIfAbsent: async ({ uid, fullname, mid }) => {
        try {
            await prisma.customer.upsert({
                where: { uid },
                update: {},
                create: { uid, fullname, mid },
            });
        } catch (e) {
            if (e.code !== 'P2002') throw e;
        }
    },

    update: (uid, data) => prisma.customer.update({ where: { uid }, data, include }),
};