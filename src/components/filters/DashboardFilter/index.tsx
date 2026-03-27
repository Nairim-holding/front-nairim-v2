import { useRouter } from "next/navigation";
import FilterDate from "./FilterDate";

type FilterType = "map" | "financial" | "portfolio" | "clients";

export default function DashboardFilter({
  filter,
  setFilter
}: {
  filter: FilterType;
  setFilter: (filter: "financial" | "portfolio" | "clients" | "map") => void;
}) {
  const router = useRouter();

  const handleDateFilter = (startDate: string, endDate: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    
    // Use push em vez de replace para garantir mudança
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col justify-center mb-2 w-full">
      <div className="flex justify-start items-center gap-5 mb-5 pl-10">
        <span className="text-3xl font-normal font-poppins">
          {filter === 'financial' && 'Financeiro'}
          {filter === 'portfolio' && 'Imóveis'}
          {filter === 'clients' && 'Proprietários'}
          {filter === 'map' && 'Localização dos Imóveis'}
        </span>
      </div>
      <div className="flex items-center justify-between px-2 w-full">
        <div className="flex items-center justify-start gap-5 w-full">
          <span className="text-2xl font-bold text-content">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.0011 12V19.88C14.0411 20.18 13.9411 20.5 13.7111 20.71C13.6186 20.8027 13.5087 20.8762 13.3877 20.9264C13.2668 20.9766 13.1371 21.0024 13.0061 21.0024C12.8751 21.0024 12.7455 20.9766 12.6245 20.9264C12.5035 20.8762 12.3936 20.8027 12.3011 20.71L10.2911 18.7C10.1821 18.5933 10.0992 18.4629 10.0489 18.319C9.99861 18.175 9.98225 18.0213 10.0011 17.87V12H9.97111L4.21111 4.62C4.04872 4.41153 3.97544 4.14726 4.0073 3.88493C4.03915 3.6226 4.17354 3.38355 4.38111 3.22C4.57111 3.08 4.78111 3 5.00111 3H19.0011C19.2211 3 19.4311 3.08 19.6211 3.22C19.8287 3.38355 19.9631 3.6226 19.9949 3.88493C20.0268 4.14726 19.9535 4.41153 19.7911 4.62L14.0311 12H14.0011Z" fill="var(--color-text-secondary)"/>
            </svg>
          </span>
          <FilterDate onApply={handleDateFilter} />
          {/* {filter === "map" && (
            <div className="flex gap-4 w-full pr-5">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="border border-ui-border rounded-md p-2 h-[45px]"
              >
                <option value="">Selecione um imóvel</option>
                <option value="sp">São Paulo</option>
                <option value="rj">Rio de Janeiro</option>
                <option value="bh">Belo Horizonte</option>
              </select>
              
              <div className="flex border py-2 px-3 rounded-lg border-ui-border max-w-[600px] w-full gap-3">
                <input
                  className="border-none outline-none w-full text-[14px] font-normal text-content-secondary"
                  type="search"
                  placeholder="Pesquise por endereço, cidade, estado ou país"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={25} color="var(--color-text-muted)" />
              </div>
            </div>
          )} */}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("financial")}
            className={`cursor-pointer w-[40px] h-[40px] flex items-center justify-center rounded-sm ${filter === "financial" ? "bg-gradient-to-r from-brand to-brand-hover border-none shadow-purple-soft" : "border border-ui-border bg-surface-subtle"}`}
            aria-label="Filtrar Financeiro"
            title="Financeiro"
          >
            <svg width="25" height="25" viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.7 18V15.85C2.81667 15.65 2.05417 15.2667 1.4125 14.7C0.770833 14.1333 0.3 13.3333 0 12.3L1.85 11.55C2.1 12.35 2.47083 12.9583 2.9625 13.375C3.45417 13.7917 4.1 14 4.9 14C5.58333 14 6.1625 13.8458 6.6375 13.5375C7.1125 13.2292 7.35 12.75 7.35 12.1C7.35 11.5167 7.16667 11.0542 6.8 10.7125C6.43333 10.3708 5.58333 9.98333 4.25 9.55C2.81667 9.1 1.83333 8.5625 1.3 7.9375C0.766667 7.3125 0.5 6.55 0.5 5.65C0.5 4.56667 0.85 3.725 1.55 3.125C2.25 2.525 2.96667 2.18333 3.7 2.1V0H5.7V2.1C6.53333 2.23333 7.22083 2.5375 7.7625 3.0125C8.30417 3.4875 8.7 4.06667 8.95 4.75L7.1 5.55C6.9 5.01667 6.61667 4.61667 6.25 4.35C5.88333 4.08333 5.38333 3.95 4.75 3.95C4.01667 3.95 3.45833 4.1125 3.075 4.4375C2.69167 4.7625 2.5 5.16667 2.5 5.65C2.5 6.2 2.75 6.63333 3.25 6.95C3.75 7.26667 4.61667 7.6 5.85 7.95C7 8.28333 7.87083 8.8125 8.4625 9.5375C9.05417 10.2625 9.35 11.1 9.35 12.05C9.35 13.2333 9 14.1333 8.3 14.75C7.6 15.3667 6.73333 15.75 5.7 15.9V18H3.7Z" fill={filter === "financial" ? "var(--color-text-inverse)" : "var(--color-text-muted)"}/>
            </svg>
          </button>

          <button
            onClick={() => setFilter("portfolio")}
            className={`cursor-pointer w-[40px] h-[40px] flex items-center justify-center rounded-sm ${filter === "portfolio"? "bg-gradient-to-r from-brand to-brand-hover border-none shadow-purple-soft" : "border border-ui-border bg-surface-subtle"}`}
            aria-label="Filtrar Portfólio"
            title="Portfólio"
          >
            <svg width="27" height="27" viewBox="0 0 23 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.3114 0.43918C12.0302 0.157973 11.6487 0 11.2509 0C10.8532 0 10.4717 0.157973 10.1904 0.43918L0.219947 10.4082C0.150216 10.4779 0.0949011 10.5607 0.0571625 10.6518C0.0194238 10.7429 0 10.8406 0 10.9392C0 11.0378 0.0194238 11.1354 0.0571625 11.2266C0.0949011 11.3177 0.150216 11.4004 0.219947 11.4702C0.360777 11.611 0.551784 11.6901 0.750947 11.6901C0.849563 11.6901 0.947213 11.6707 1.03832 11.633C1.12943 11.5952 1.21222 11.5399 1.28195 11.4702L11.2509 1.49968L21.2199 11.4702C21.3608 11.611 21.5518 11.6901 21.7509 11.6901C21.9501 11.6901 22.1411 11.611 22.2819 11.4702C22.4228 11.3293 22.5019 11.1383 22.5019 10.9392C22.5019 10.74 22.4228 10.549 22.2819 10.4082L18.7509 6.87868V1.93918C18.7509 1.74027 18.6719 1.5495 18.5313 1.40885C18.3906 1.2682 18.1999 1.18918 18.0009 1.18918H16.5009C16.302 1.18918 16.1113 1.2682 15.9706 1.40885C15.83 1.5495 15.7509 1.74027 15.7509 1.93918V3.87868L12.3114 0.43918Z" fill={filter === "portfolio" ? "var(--color-text-inverse)" : "var(--color-text-muted)"}/>
              <path d="M11.25 3.12866L20.25 12.1287V18.4392C20.25 19.0359 20.0129 19.6082 19.591 20.0302C19.169 20.4521 18.5967 20.6892 18 20.6892H4.5C3.90326 20.6892 3.33097 20.4521 2.90901 20.0302C2.48705 19.6082 2.25 19.0359 2.25 18.4392V12.1287L11.25 3.12866Z" fill={filter === "portfolio" ? "var(--color-text-inverse)" : "var(--color-text-muted)"}/>
            </svg>
          </button>

          <button
            onClick={() => setFilter("clients")}
            className={`cursor-pointer w-[40px] h-[40px] flex items-center justify-center rounded-sm ${filter === "clients" ? "bg-gradient-to-r from-brand to-brand-hover border-none shadow-purple-soft" : "border border-ui-border bg-surface-subtle"}`}
            aria-label="Filtrar Clientes"
            title="Clientes"
          >
            <svg width="25" height="25" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.3428 1.52719C12.4306 0.542344 11.1565 0 9.75027 0C8.33652 0 7.05824 0.539062 6.15027 1.51781C5.23246 2.50734 4.78527 3.85219 4.89027 5.30437C5.09839 8.16937 7.27855 10.5 9.75027 10.5C12.222 10.5 14.3984 8.16984 14.6098 5.30531C14.7162 3.86625 14.2662 2.52422 13.3428 1.52719ZM18.0003 21H1.50027C1.2843 21.0028 1.07042 20.9574 0.874189 20.8672C0.677959 20.7769 0.504316 20.6441 0.365893 20.4783C0.0612056 20.1141 -0.0616069 19.6167 0.0293306 19.1137C0.424956 16.9191 1.65964 15.0755 3.60027 13.7812C5.32433 12.6323 7.50824 12 9.75027 12C11.9923 12 14.1762 12.6328 15.9003 13.7812C17.8409 15.075 19.0756 16.9186 19.4712 19.1133C19.5621 19.6162 19.4393 20.1136 19.1346 20.4778C18.9963 20.6437 18.8226 20.7766 18.6264 20.867C18.4302 20.9573 18.2163 21.0028 18.0003 21Z" fill={filter === "clients" ? "var(--color-text-inverse)" : "var(--color-text-muted)"}/>
            </svg>
          </button>

          <button
            onClick={() => setFilter("map")}
            className={`cursor-pointer w-[40px] h-[40px] flex items-center justify-center rounded-sm ${filter === "map" ? "bg-gradient-to-r from-brand to-brand-hover border-none shadow-purple-soft" : "border border-ui-border bg-surface-subtle"}`}
            aria-label="Filtrar Mapa"
            title="Mapa"
          >
            <svg width="28" height="28" viewBox="0 0 23 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16.6154 0C14.5763 0 12.9231 1.65508 12.9231 3.69231C12.9231 6.15231 16.1538 9.51323 16.1538 12.8945H17.0769C17.0778 9.51323 20.3077 6.24923 20.3077 3.69231C20.3077 1.65508 18.6545 0 16.6154 0ZM16.6154 1.78892C16.8655 1.78904 17.1131 1.83842 17.3441 1.93423C17.5751 2.03005 17.7849 2.17042 17.9617 2.34733C18.1384 2.52425 18.2786 2.73425 18.3742 2.96534C18.4698 3.19642 18.5189 3.44408 18.5188 3.69415C18.5186 3.94423 18.4693 4.19184 18.3735 4.42283C18.2776 4.65383 18.1373 4.86369 17.9604 5.04043C17.7834 5.21718 17.5734 5.35735 17.3424 5.45294C17.1113 5.54852 16.8636 5.59766 16.6135 5.59754C16.1084 5.59729 15.624 5.39638 15.2669 5.03899C14.9099 4.6816 14.7094 4.19702 14.7097 3.69185C14.7099 3.18667 14.9109 2.70228 15.2682 2.34524C15.6256 1.9882 16.1102 1.78868 16.6154 1.78892ZM11.0769 1.84615C4.96892 1.84615 0 6.81508 0 12.9231C0 19.0311 4.96892 24 11.0769 24C17.1849 24 22.1538 19.0311 22.1538 12.9231C22.1538 11.0677 21.6942 9.32677 20.8846 7.788C20.7618 8.03169 20.6382 8.26338 20.5098 8.50985C20.2671 8.97877 20.0114 9.45231 19.788 9.92308C20.0188 10.5831 20.1775 11.2809 20.2495 12H19.0385C18.972 12.3092 18.9231 12.6 18.9231 12.8945V13.8462H20.2505C20.1246 15.1474 19.7211 16.4065 19.0671 17.5385H16.3569C16.56 16.6726 16.6772 15.7154 16.7603 14.7406H14.9418C14.8547 15.6849 14.6911 16.6206 14.4526 17.5385H7.70123C7.389 16.3304 7.20521 15.0928 7.15292 13.8462H14.3068V12.8945C14.2995 12.5931 14.2608 12.2933 14.1914 12H7.15385C7.20613 10.7534 7.38992 9.51573 7.70215 8.30769H12.6351C12.3146 7.70321 12.016 7.08743 11.7397 6.46154H8.33631C9.09969 4.71969 10.1086 3.69231 11.0769 3.69231C11.0769 3.05077 11.1923 2.448 11.3945 1.87477C11.2883 1.87108 11.184 1.84615 11.0769 1.84615ZM7.26923 4.52862C6.90179 5.14265 6.59275 5.78979 6.34615 6.46154H4.5C5.29636 5.65242 6.23514 4.99715 7.26923 4.52862ZM3.08677 8.30769H5.79692C5.51761 9.52028 5.3535 10.7565 5.30677 12H1.90338C2.0292 10.6988 2.43274 9.43965 3.08677 8.30769ZM1.90338 13.8462H5.30769C5.36215 15.1615 5.532 16.4031 5.79785 17.5385H3.08677C2.43274 16.4065 2.0292 15.1474 1.90338 13.8462ZM4.5 19.3846H6.34615C6.612 20.1009 6.92308 20.7443 7.26923 21.3175C6.23514 20.849 5.29636 20.1937 4.5 19.3846ZM8.33631 19.3846H13.8175C13.0542 21.1265 12.0452 22.1538 11.0769 22.1538C10.1086 22.1538 9.09877 21.1265 8.33631 19.3846ZM15.8077 19.3846H17.6538C16.8575 20.1937 15.9187 20.849 14.8846 21.3175C15.2308 20.7452 15.5418 20.1018 15.8077 19.3846Z" fill={filter === "map" ? "var(--color-text-inverse)" : "var(--color-text-muted)"}/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
