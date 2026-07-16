# Dobre Jedzenie

Instalowalna aplikacja PWA z prostymi przepisami niskowęglowodanowymi, bez mąki i cukru, z wyjątkiem świadomie używanej mieszanki MK Gold do wybranych wypieków.

## Co już działa

- wyszukiwanie zwykłym językiem, np. „lekka kolacja”, „kokosowe”, „do 15 minut”;
- kafelki zachcianek i potrzeb;
- szczegóły przepisu w czytelnym oknie;
- ulubione zapisywane lokalnie na urządzeniu;
- działanie bez internetu po pierwszym otwarciu;
- możliwość instalacji na ekranie telefonu;
- układ przystosowany do obsługi jednym kciukiem.

## Jak uruchomić lokalnie

Nie otwieraj pliku `index.html` bezpośrednio, bo mechanizm offline wymaga serwera.

Najprościej:

```bash
python -m http.server 8000
```

Następnie otwórz:

```text
http://localhost:8000
```

## Jak opublikować na GitHub Pages

1. Utwórz nowe repozytorium, np. `dobre-jedzenie`.
2. Wgraj do niego wszystkie pliki z tego folderu, zachowując folder `icons`.
3. Na GitHubie otwórz `Settings` → `Pages`.
4. W sekcji `Build and deployment` wybierz `Deploy from a branch`.
5. Wybierz gałąź `main` i folder `/root`, następnie zapisz.
6. Po chwili GitHub pokaże adres aplikacji.

## Jak dodać ikonę na telefonie

### Android / Chrome
Otwórz adres aplikacji, wybierz menu przeglądarki i użyj `Dodaj do ekranu głównego` albo przycisku `Zainstaluj aplikację`.

### iPhone / Safari
Otwórz stronę w Safari, wybierz `Udostępnij`, następnie `Do ekranu początkowego`.

## Gdzie dodawać przepisy

Wszystkie przepisy są w pliku `recipes.js`. Każdy ma tytuł, czas, tagi, składniki, kroki i ważną poradę. To celowo prosta baza, żeby można ją było łatwo rozwijać bez serwera i bez płatnych usług.

## Uwaga o wartościach odżywczych

Ta wersja nie podaje wyliczonego makro. Skład produktów różni się między markami, więc wartości trzeba liczyć na podstawie konkretnych etykiet. W kolejnej wersji można dodać kalkulator porcji i węglowodanów.

## Przenoszenie własnych przepisów

W aplikacji wybierz `Przenieś moje przepisy`.

- `Zapisz kopię` tworzy jeden plik JSON z własnymi przepisami i ulubionymi. Na telefonie można od razu zapisać go na Dysku Google przez systemowe menu udostępniania.
- `Wczytaj kopię` odtwarza bazę na nowym urządzeniu.

Plik kopii nie zawiera przepisów wbudowanych w aplikację, ponieważ te są częścią samej aplikacji.
