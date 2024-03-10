import { error } from "@sveltejs/kit";
import { prisma } from '$lib/prisma.server.js';
export async function load({ params, cookies, fetch }) {
    const uniqueCode = params.uniquecode;
    const userverif = await prisma.UserVerify.findUnique({
        where : {uniqueCode},
        select : {
            email : true,
        }
    })
    if (userverif){
        const res = await fetch(`/api/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uniqueCode)
        });
        if (!res.ok) {
            if (res.status === 400){
                error(res.status, {message : 'Expired Unique Code', description : 'Please use a valid verification link'})
            }else{
                error(res.status, 'Not Found')
            }
        }
        const result = await res.json();
        const user = await prisma.user.findUnique({
            where : {email : userverif.email},
            select : {
                roleId : true,
            }
        })
        if (result.authToken){
            cookies.set('AuthorizationToken', result.authToken, {
                path: '/',
                httpOnly: true,
                secure : true,
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 // one day
            });
            return { success : true, user : userverif.email, roleId : user?.roleId };
        }else{
            return {success : false}
        }
    }else{
        error(404, {message : 'User Not Found', description : 'Please ensure that the information you entered is correct'})
    }
}
