import { describe, it, expect, beforeEach } from "vitest";
import { cleanEmail, emailKey, signup, summary, toCsv, emailList, memoryStore, _setTesterStore, LIMITS } from "../server/v3/testers";

describe("v3.11.2 tester sign-ups", () => {
  let st: ReturnType<typeof memoryStore>;
  beforeEach(() => { st = memoryStore(); _setTesterStore(st); });
  it("validates and normalises emails", () => {
    expect(cleanEmail(" Ada.Obi+fb@GoogleMail.com ")).toBe("ada.obi@gmail.com");
    expect(cleanEmail("a@b")).toBe("");
    expect(cleanEmail("a..b@gmail.com")).toBe("");
    expect(cleanEmail("<script>@x.com")).toBe("");
    expect(emailKey("ada.obi@gmail.com")).toBe("adaobi@gmail.com");
    expect(emailKey("ada.obi+x@yahoo.com")).toBe("ada.obi@yahoo.com");
  });
  it("stores, de-duplicates and keeps optional fields", () => {
    expect(signup({ email: "Ada.Obi@gmail.com", name: "Ada", phone: "Tecno Spark 20" }, "1.1.1.1")).toMatchObject({ ok: true, dup: false, platform: "android" });
    expect(signup({ email: "adaobi+2@gmail.com" }, "1.1.1.2")).toMatchObject({ ok: true, dup: true });
    expect(st.rows.length).toBe(1);
    expect(st.rows[0]).toMatchObject({ email: "ada.obi@gmail.com", name: "Ada", phone: "Tecno Spark 20" });
  });
  it("honeypot stores nothing, bad email is refused", () => {
    expect(signup({ email: "bot@gmail.com", website: "x" }, "9.9.9.9")).toMatchObject({ ok: true, bot: true });
    expect(signup({ email: "nope" }, "9.9.9.9")).toMatchObject({ ok: false, status: 400 });
    expect(st.rows.length).toBe(0);
  });
  it("rate-limits per IP", () => {
    for (let i = 0; i < LIMITS.shortMax; i++) expect(signup({ email: `p${i}@gmail.com` }, "5.5.5.5").ok).toBe(true);
    expect(signup({ email: "late@gmail.com" }, "5.5.5.5")).toMatchObject({ ok: false, status: 429 });
    expect(signup({ email: "other@gmail.com" }, "6.6.6.6").ok).toBe(true);
  });
  it("admin summary, CSV and Play list (Android only)", () => {
    signup({ email: "a@gmail.com", name: "=SUM(1)" }, "1"); signup({ email: "b@icloud.com", platform: "iphone" }, "1"); signup({ email: "c@gmail.com" }, "1");
    expect(summary()).toMatchObject({ total: 3, android: 2, iphone: 1, androidNew: 2 });
    expect(emailList("new")).toBe("a@gmail.com, c@gmail.com");
    st.setStatus(["a@gmail.com"], "added");
    expect(emailList("new")).toBe("c@gmail.com");
    expect(emailList("all")).toBe("a@gmail.com, c@gmail.com");
    const csv = toCsv(st.list());
    expect(csv.split("\r\n")[0]).toBe("email,name,phone_model,platform,status,signed_up_utc");
    expect(csv).toContain("'=SUM(1)");
  });
});
