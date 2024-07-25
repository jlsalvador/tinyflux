/**
 * @typedef {import('./popup.js').Entry} Entry
 * @typedef {import('./popup.js').Icon} Icon
 */

/** @type {Icon} */
export const testIcon = {
  id: 20,
  data: "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=",
  mime_type: "image/png",
};

const testContent = `<header>
      <h1>Breaking News!</h1>
    </header>
    <section>
      <figure>
        <img
          width="512px"
          height="288px"
          src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSgBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/CABEIASACAAMBIgACEQEDEQH/xAAbAAEAAgMBAQAAAAAAAAAAAAAABgcDBAUBAv/aAAgBAQAAAAC/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADzC9zGDOYfM4AMDOa/wBZjWyZQAAADl17m3bD+YPybQROO+SGXACJR75kcthfMxyaSwXUwS3vgAAAI3rS0hGDm2ggU41a6tQi8j8j8meQOcaleWlU1rc6F2HV1rcWL2GAAAAhsf8AuUSf50q+tARzgWEcOL+SrthG+FYMHx6/dk8By6MmkIAAADzzWrK08uhX1oHKhFg7Zhrz2w8o5MJsLLWsq1OVPK4lvO1Z8AAAAwZ8NXWll0K+tByoPYG6K/k3zHZ8cmEWBu82v7S16tsCG2ZoVzaoAAACB6OKTSniRXmdicVj9fXtm5GLKx5GvWP19e2bA8GLty6vvNeRSsAAAA1smV8YzNhGcA8wjO1vvMa2TKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/xAAuEAACAgEDAwEIAQUBAAAAAAACAwEEBQAGERASFFQTICEjMTI1QDAVIjM0kEH/2gAIAQEAAQwA/wCxpFAjJFMQPl1vUJ15db1CdRarlMRD1TPUbdYigRsJkur7ddE8PepcouVnzwiwlk/yPt10Tw+wpcouVnzwiwlk9XXaqC7XWUrJFlFj/A9TfcbfqJLtbaQBIsJfHKHLZH7e52+xwdqf/UIc8pFCmNL+nXvR2dYjE3mZGvJVmrDTWApZMaUAG4dwnd7q9OZCtifytPrujOsU0qdI+2aeOu5CSKuk26u4+3QkZspNetq5xpvGlcOTj+LdGdYtxU6R9k08ddyEkVdJt1dx9ugQzZSatbVzjWOGlcOT6bnzrTsHUpnIKx+CvX1e1UAiu/jbuKMDcMhraubO5M1LZdztbjzrbTzr1WSFajt+/cTDQAQXdo3cS8JbBKLa2ZLIASLMx5H7W+W9uOSqPrsNX+26fc3lYueb7B39tatgWRi7F25yuMT+Vp9J54nj6s23lGWZlgBOqlddWstCo4DPqBuGuQyImKREN2uQfd1yG5/HyvsVqma9Z6rKAcg4NduwqpXNzzgF4vc3lZOUNV2q6FzxPH1PbWTZZ+YATqqhdautKo4DcCgbhrcMiJigUjerkP3TzxPH1Lnunu57q4gKFirj2e6BAsFa9pxxt2SjN0+z63JKKj5D70QMuXDPsiIiIiI4jeIhODZJ8d20pL+vV+36ftb7Mps1Q4ntrOtiErrMfABkL9dnws2ALbu4itNGre7Ybo1gzjvAS1nvw1zWJ/K0/d3lkRRT8Nc8u2rQK5lFnMfK67iwY5FcuREDaw2Ufh7RLaJSnL5KxmbggsS9nt3CBjVw10QVr3d5ZEU0/DXPLdqUCt5QGTHytbowpVnMto7Zr4vc1mlXFLFi8MznLGTCFkIqTtTClWKLtnt79bkwpUHE9PbNXH7ps1kCpyhfGXzFjKkAHAgrauGKiM2rHbLv2jETGRMYIQAQGBAYEclQRkKxKeETM9yXfCe06jfb1Ut6Z78Nc1ifytP3M9mF4tHEcHZq17WYyExEybcZRTjqgoRHw627Cqlc3POAXlbh5fJ96k8Th7pYjJd7k86rPVZQDkHBr9zPZheMRwPB2ala1mMhMRMmzG0U4+oKER8LbxrVmvZ9t65ZydvvaUkdHadYUjNwzY3N7YWiqdiiZzrb+VbjrYDJzNbI2hpUXWDjmHOs5S8MsKWOqbTqAqPJNjWZ/bYVKxWaZmQbXyrad1dczma37TrddLQU56wZq5ZXUqse6eA/ve/4RydVXsKqVdM9+GuaxP5Wn1z2YVi0cRwdhCbeYyExEyx2JxycbVhSY5L3NwXLmRyU1jUYa29hAxq4a6IO1uLBjkVy5EQNrbdy5RyUVQUZj1z2YXi0cRwdmui1mMhMRMsdiscnG1YUmOZ1uMSPCW4H641opyNVrPsiYmImJ5jItBFCwxsxADEkUCMczulZzt9sR8ZwTQRmKrGzEBrOtBOHtkyYiKgEdtIB937W5cXeC42yyJeqrmchVCATaOAtXbuRMRe1ji2zgDQ0bd4e09bqv2MfUSyqUCVnP5CwhiWtGVpYSXLaueDjcuT5j5wayD5q0XviOZsvbZebnnJsRbsVwIUOYqPOt+qfoMhcAoIbT4muUmhZl9ekoVNiHysZd0FCheThWMN6ZGxNWhYeMRJWXssvNzzk2It2K4ECHMVHnW/VP0GQuAUENp8Sv5tcfaRExnMC+i02IAm1aOdv01QpTu5d/KXcj2hYbJDtnAN9uFu6EgLlg5RqZHcGZwdnHMIhEmVqm4MjVVCwdBhdyFzJmIvYTNbXwLEuG5dHsL9ttCm4u5tVBkishEfIStfViltiIaAnHiVvTp14lb06deJW9OnRDBDIlESPiVvTp14lb06deJW9OnXiVvTp1EREcRHEfwEMGMiUQQ+JW9OnXiVvTp14lb06deJW9OnURxHEfCNNo1HF3NqoMkVa6J5QhS56sx9NpdzKlciRWQj/AAJUv/sf/8QANxAAAgEBBQQHBgYDAQAAAAAAAQIRAAMSITFREEFhcSAicoGRsdETQEJiobIjMDJzweEzUpBj/9oACAEBAA0/AP8AsaMSTurtiu2KOAAcdAmAA4x6GjuB51ojgn83R3A860RwT0NGcA18jg+XQ0a0ANfIwPl74wCDvIFASQiliPCv2m9KV1ZmdCoABnfsUSWJgCsi2Rf0Fe2T7htXC0tBnOgqcWJgTzNE4NmJ5imws3Y4g6HX8tcLS0Gc6DSpxYmBPM0Tg2YnmKb/ABuxxnQ67EN13UwWO8TpRyZzE8qJ6tojYTz3UBKPvYaHjsU3SVMF+PKmxU2jRNfBaI2B5EVZiQ3+49fe3tJ7gD6iuqg+pP8AHQi9Zhcm4njS2Zazs95MYE6CvbJ9w2u0taXxAnM60ggULNmHMCRQtFI5z0LMlbSRDE8OX1phIIpRJJq0aLIgSRz5/Tbup2lrS+IE5nWkEAUtmWHAjEULRSPHZOM0FAWNIwoAEc5EVf8ApGP0q40c4osJ5TQyig6lec+k1DTyun3tULTGEk/1RMlbMkCe6huLnyNNgloMLx0PHYpkSJg17I17ZPuHRtv1R8K/361YEOx47h4+XQUdzjQ+tXotLI5g6jjUxZWQ8zxphidyDQevStcWj4V/urAh2PHcPHy2OZZZgqT5ikEKSYIGk0DNxd54miPw1BmAd87HMgTivCKUQGJgxx1pTKouU6k06wqgzdHPX3s5giRQyAECiOq0YqdRSNmNxFWiK3iJ2eyNe2T7h0HHUT+Twpzedzko1NDFmObHU9BRJJpoRFUdY6TqaEo6kdZeXGmEgjouOomnE8Kc3ndslGpoYljmx1NWalj3UxhEGQnICiMQphRVmLzWbmZG+DTmHQ5DiKs1kDU7h41aMFUbhO4aCt903R3UmLo+JA1Bq1a6VPwk5Ee9v+lWYAnYgnnwq0bADeSas0C+AjZ7I17ZPuG1h1E/k8KtDLMcgNToKOLuc2PRRrqWG+deJphidyDQetKO5xofWnaHsd4OvCOgw6iacTwpzLOcgNTwo4u5zY7Lk9wIJpLVWbkDRpUMzyyomAKW6T4ig8EndOGw2bKOJIgedM6gc597czfUfpGhG6KGQYBo8anqoBv4AUMbOzO46nY1pdMgHCDTi6wuAYUjBlPEV+2Ks0LAHeQKYySaYybhuk94r9w0P/Q0ygnw2hboeMQNNrABnAxIG2zQsAdYpzJJpjJuNdnvFfuGhiPxDToLw3GRRMgqJK8D60MlcTHKpwRRAnkM6Q3ks2zJ1I3U4KsNQanq2iiYHHShgA6zHfU9VFGE8hS/47M5g6n3zVrME18igeW0YwwmuwK7ArsCjgQRnXYFdgV2BXYFD8k5giQa7ArsCuwK7A26tZgmvkQDy6GpswTXyIB5f9j/AP/EABQRAQAAAAAAAAAAAAAAAAAAAJD/2gAIAQIBAT8AED//xAAUEQEAAAAAAAAAAAAAAAAAAACQ/9oACAEDAQE/ABA//9k="
          alt="A photo of a beautiful sunset"
        />
        <figcaption>A photo of a beautiful sunset.</figcaption>
      </figure>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec justo
        sed lectus aliquet elementum.
      </p>
    </section>
    <footer>
      <p><em>Source: The Tinyflux Project</em></p>
    </footer>`;

/** @type {Entry} */
export const testEntry = {
  author: "Author",
  changed_at: "2024-07-11T13:12:10.690975+02:00",
  comments_url: "https://example.com/comments",
  content: testContent,
  created_at: "2024-07-11T13:12:10.690975+02:00",
  enclosures: [
    {
      entry_id: 121699,
      id: 23751399,
      media_progression: 0,
      mime_type: "image/*",
      size: 0,
      url: "https://picsum.photos/536/354",
      user_id: 1,
    },
  ],
  feed: {
    allow_self_signed_certificates: false,
    apprise_service_urls: "",
    blocklist_rules: "",
    category: {
      id: 8,
      title: "Noticias",
      user_id: 1,
      hide_globally: false,
    },
    checked_at: "2024-07-11T13:12:06.025126+02:00",
    cookie: "",
    crawler: false,
    description: "",
    disable_http2: false,
    disabled: false,
    etag_header: "",
    feed_url: "https://example.com/rss",
    fetch_via_proxy: false,
    hide_globally: false,
    icon: {
      feed_id: 28,
      icon_id: 20,
    },
    id: 28,
    ignore_http_cache: false,
    keeplist_rules: "",
    last_modified_header: "",
    next_check_at: "0001-01-01T00:00:00Z",
    no_media_player: false,
    parsing_error_count: 0,
    parsing_error_message: "",
    password: "",
    rewrite_rules: "",
    scraper_rules: "",
    site_url: "https://example.com/",
    title: "Feed title",
    urlrewrite_rules: "",
    user_agent: "",
    user_id: 1,
    username: "",
  },
  feed_id: 28,
  hash: "49c994b75dc859ad39d40cadbab8dd537070447157876ab7635dec16a04264fe",
  id: 121699,
  published_at: "2024-07-11T13:05:04+02:00",
  reading_time: 1,
  share_code: "",
  starred: false,
  status: "unread",
  tags: ["news", "world"],
  title: "News title",
  url: "https://example.com/121699",
  user_id: 1,
};

export function testEntries() {
  function shuffle(array) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }
  }

  const entries = [];
  for (let i = 0; i < 5; i++) {
    const entry = structuredClone(testEntry);
    entry.id = i;
    entry.title += ` #${i}`;
    entry.starred = Math.random() < 0.5 ? true : false;
    entry.reading_time = Math.floor(Math.random() * (10 - 1 + 1) + 1);
    entry.published_at = (function () {
      const today = new Date();
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay() - 8
      );
      const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + today.getDay() + 8
      );
      return new Date(
        start.getTime() + Math.random() * (end.getTime() - start.getTime())
      );
    })();
    entries.push(entry);
  }
  shuffle(entries);
  return entries;
}
