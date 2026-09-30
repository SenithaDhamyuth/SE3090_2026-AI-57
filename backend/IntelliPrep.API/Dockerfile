# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /App

# Copy everything and restore
COPY . ./
RUN dotnet restore

# Build and publish a release
RUN dotnet publish -c Release -o out

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /App
COPY --from=build-env /App/out .

# Tell Render to run your API
ENTRYPOINT ["dotnet", "IntelliPrep.API.dll"]